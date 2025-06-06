// Matcher for launch site names to canonical site IDs.
// Loads a table of site aliases and provides a function to match raw site names to known sites.

import { readFile } from "fs/promises";
import path from "path";
import fs from "fs/promises";
import {
  makeAliasTable, matchStringFuzzy, // Builds a lookup table of aliases to IDs
} from "./matchUtils";
import { LaunchData, LaunchSite, LaunchSiteGPTMatch, MatchResult } from "../types";
import { callOpenAI } from "../utils/openai";
import { createLaunchSiteFile } from "../updater/launchSiteFileUpdater";

const knownSitesFilePath = path.resolve(__dirname, '../../data/launch-sites.json');
const knownLaunchSites = async (): Promise<Record<string, LaunchSite>> => JSON.parse(await readFile(knownSitesFilePath, "utf8"));

/* ---------- one-time table build ---------- */

// Loads the launch site table from a JSON file.
// Each site entry generates a list of possible aliases, including algorithmic expansions for common naming patterns.
// ex: 
export async function loadSiteTable(
  knownSites?: Record<string, LaunchSite>
) {
  if (!knownSites) {
    knownSites = await knownLaunchSites();
    if (!knownSites) throw new Error("Failed to load known launch sites");
    console.log("📄 Loaded known launch sites");
  }

  const table = makeAliasTable(knownSites, (entry: LaunchSite) => {
    const sn = entry.site_name;
    const list: string[] = [
      `${sn}, ${entry.location}`,
    ];

    // algorithmic expansions ----------------------------------
    // Add common variations for SLC and LC site names
    const slc = sn.match(/^(SLC|LC)-(\d+)([A-Z])?$/i);
    if (slc) {
      const [, prefix, num, ew] = slc;
      list.push(`Space Launch Complex ${num}${ew || ""}, ${entry.location}`.trim());
      list.push(`Launch Complex ${num}${ew || ""}, ${entry.location}`.trim());

      if (ew) {
        const dir = ew === "E" ? "East" : ew === "W" ? "West" : "";
        list.push(`${prefix} ${num} ${dir}, ${entry.location}`.trim());
        list.push(`Space Launch Complex ${num} ${dir}, ${entry.location}`.trim());
        list.push(`Launch Complex ${num} ${dir}, ${entry.location}`.trim());
      }
    }

    return list;
  });
  console.log(`🔗 Built site alias table with ${Object.keys(table).length} entries`);
  return table;
}

/* ---------- matcher ---------- */

export async function matchSite(
  launchData: LaunchData,
  table?: Record<string, string>
): Promise<MatchResult> {
  if (!table) {
    table = await loadSiteTable();
    if (!table) throw new Error("Failed to load launch site table");
  }

  const raw = launchData.location;
  if (!raw) {
    console.log("❌ No location found in launch data");
    return { id: "", score: 0, verdict: "no_match" };
  }

  console.log(`🔍 Attempting to match site: '${raw}'`);
  // Use fuzzy matching to find the best (or closest) match.
  const fuzzyMatch = matchStringFuzzy(raw, table);
  console.log(`🧐 Fuzzy match verdict: ${fuzzyMatch.verdict}, id: ${fuzzyMatch.id}`);

  // If the match verdict is "gpt_check" or "no_match", construct a prompt and send it off to GPT for verification.
  if (fuzzyMatch.verdict !== "match") {
    console.log("🤖 Sending to GPT for site match verification...");
    return await gptCheckSiteMatch(launchData, fuzzyMatch);
  }

  return fuzzyMatch;
}

async function gptCheckSiteMatch(launchData: LaunchData, fuzzyMatch: MatchResult): Promise<MatchResult> {
  // Load the known launch sites from the JSON file
  let siteCandidates = await knownLaunchSites();
  if (!siteCandidates) throw new Error("Failed to load known launch sites");

  // If the fuzzy match is a "gpt_check", let's limit the candidates to those at the same location.
  // This is to avoid sending a huge list of sites to GPT, which may not be necessary.
  if (fuzzyMatch.verdict === "gpt_check") {
    // Find the site candidate in the known sites
    const siteCandidate = siteCandidates[fuzzyMatch.id];
    if (!siteCandidate) throw new Error(`Site candidate not found in known sites: ${fuzzyMatch.id}`);

    // Find all other site candidates at the same location
    siteCandidates = Object.entries(siteCandidates).reduce((sites, [id, site]) => {
      if (site.location === siteCandidate.location) {
        sites[id] = site;
      }
      return sites;
    }, {} as Record<string, LaunchSite>);
  }
  
  const prompt = `You are a launch-site resolver. Your job is to determine if a launch location refers to a known launch site or if it is a new site that needs to be added to the database.
You will be given the following information:

1. launchData that includes information about a launch event (as JSON)
2. Launch site candidates from a database of known sites (as JSON)

First determine if the launch location refers to a known site. If it does not then do a bit of extra work to determine if it is a new site that needs to be added to the database, of if the launch data deos not refer to a launch site at all. If it seems that there is a valid site not in the db, use any tools at your disposal to determine the site name, location, and geo coordinates. If you are not sure, it's ok to return no_match.

Detailed instructions about how to respond are at the end.

Launch data:
"launchData": ${JSON.stringify(launchData, null, 2)}

Launch site candidates from database of known launch sites:
${JSON.stringify(siteCandidates, null, 2)}

Instructions:
1. If the launch location clearly refers to **a candidate site**, reply:
    {
      "decision": "match",
      "slug": string; // Source candidate key value, unchanged
      "reasoning": string; // brief overview of the reasoning that informed your decision>
    }
2. If it is a **real launch site that is NOT in the candidate set**, reply:
    {
      "decision": "new_site";
      "proposed": {
          slug: string; // format: slugified site_name + location (including country, i.e. "cape-canaveral-space-force-station-florida-usa")
          site_name: string; // i.e. "SLC-40"
          location: string; // i.e. "Cape Canaveral Space Force Station, Forida, USA"
          geo: {
            latitude: number;
            longitude: number;
          };
          operator?: string;
          launch_vehicles?: string[];
      },
      "reasoning": string; // brief overview of the reasoning that informed your decision
    }
3. If it is **not a launch site or is a placeholder like "Unknown"**, reply:
    {
      "decision": "no_match";
      "reasoning": string; // brief overview of the reasoning that informed your decision
    }

JSON schema:
{
  "decision": "match" | "new_site" | "no_match",
  "slug"?: string, // required if decision == match
  "proposed"?: { // required if decision == new_site
      slug: string;
      site_name: string;
      location: string;
      geo: {
        latitude: number;
        longitude: number;
      };
      operator?: string;
      launch_vehicles?: string[];
  },
  "reasoning": string;
}`;
  
  const gptResponse = await callOpenAI([
    { role: "system", content: "You are a launch-site resolver. Reply ONLY with valid JSON matching the schema shown at the end. No other text." },
    { role: "user", content: prompt }
  ]);

  let result: LaunchSiteGPTMatch;
  try {
    result = JSON.parse(gptResponse);
  } catch (e) {
    throw new Error("Failed to parse GPT response as JSON: " + gptResponse);
  }

  console.log(`🤖 Launch site GPT response: ${JSON.stringify(result, null, 2)}`);

  // This breaks the GIT workflow, because it writes something about a launch
  // outside of the launch branch checkout/commit loop. Needs to be updated to
  // track launch log data separately and write it to a PR message rather than
  // file.
  // --- Log GPT match to file ---
  // const logEntry = {
  //   timestamp: new Date().toISOString(),
  //   launchData,
  //   fuzzyMatch,
  //   gptResponse: result
  // };
  // try {
  //   await fs.appendFile(
  //     path.resolve(__dirname, '../../log/launch-site-gpt-log.json'),
  //     JSON.stringify(logEntry) + "\n"
  //   );
  // } catch (err) {
  //   console.error("Failed to write GPT site match log:", err);
  // }
  // --- End log ---

  if (result.decision === "match") {
    return { id: result.slug || fuzzyMatch.id, score: 1, verdict: "match" };
  } else if (result.decision === "new_site" && result.proposed) {
    
    // Add new site to lainch-sites.json
    const newSite: LaunchSite = {
      site_name: result.proposed.site_name,
      location: result.proposed.location,
      geo: result.proposed.geo,
      operator: result.proposed.operator,
      launch_vehicles: result.proposed.launch_vehicles
    };
    const newSiteSlug = result.proposed.slug;
    const newSiteData = {
      [newSiteSlug]: newSite
    };

    // Append new site to the known sites JSON file and create a new launch site entry
    try {
      const knownSites = await knownLaunchSites();
      const updatedSites = { ...knownSites, ...newSiteData };
      await fs.writeFile(knownSitesFilePath, JSON.stringify(updatedSites, null, 2));
      console.log(`📝 Added new site to known sites list: ${newSiteSlug}`);

      // Add a new launch site file for the new site.
      await createLaunchSiteFile(newSiteSlug, newSite);
      console.log(`📝 Created new launch site file for ${newSite.site_name}, ${newSite.location}`);

      // Return the new site as the match result
      return { id: result.proposed.slug, score: 1, verdict: "match" };
    }
    catch (err) {
      console.error("Failed to write new site to known sites file:", err);
      return {...fuzzyMatch, verdict: "no_match" };
    }
  } else {
    return {...fuzzyMatch, verdict: "no_match" };
  }
}