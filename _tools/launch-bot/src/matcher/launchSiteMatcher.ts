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

const knownSitesFilePath = path.resolve(__dirname, '../../data/launch-sites.json');
const knownLaunchSites = async () => JSON.parse(await readFile(knownSitesFilePath, "utf8"));

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

  // If the match verdict is "gpt_check", construct a prompt and send it off to GPT for verification.
  if (fuzzyMatch.verdict === "gpt_check") {
    console.log("🤖 Sending to GPT for site match verification...");
    return await gptCheckSiteMatch(launchData, fuzzyMatch);
  }

  return fuzzyMatch;
}

async function gptCheckSiteMatch(launchData: LaunchData, fuzzyMatch: MatchResult): Promise<MatchResult> {
  // Load the known launch sites from the JSON file
  const knownSites = await knownLaunchSites();
  if (!knownSites) throw new Error("Failed to load known launch sites");

  // Find the site candidate in the known sites
  const siteCandidate = knownSites[fuzzyMatch.id];
  if (!siteCandidate) throw new Error(`Site candidate not found in known sites: ${fuzzyMatch.id}`);

  const prompt = `
Launch data:
"launchData": ${JSON.stringify(launchData, null, 2)}

Launch site candidate from database of known launch sites:
${JSON.stringify(siteCandidate, null, 2)}

Instructions:
1. If the launch location clearly refers to **the candidate site**, reply:
    {
      "decision": "match",
      "slug": string; // Source candidate site id, unchanged
      "reasoning": string; // brief overview of the reasoning that informed your decision>
    }
2. If it is a **real launch site that is NOT in the database**, reply:
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
    { role: "system", content: "You are a launch-site resolver.  Reply ONLY with valid JSON matching the schema shown at the end.  No other text." },
    { role: "user", content: prompt }
  ]);

  let result: LaunchSiteGPTMatch;
  try {
    result = JSON.parse(gptResponse);
  } catch (e) {
    throw new Error("Failed to parse GPT response as JSON: " + gptResponse);
  }

  console.log(`🤖 Launch site GPT response: ${JSON.stringify(result, null, 2)}`);

  // --- Log GPT match to file ---
  const logEntry = {
    timestamp: new Date().toISOString(),
    launchData,
    fuzzyMatch,
    gptResponse: result
  };
  try {
    await fs.appendFile(
      path.resolve(__dirname, '../../log/launch-site-gpt-log.json'),
      JSON.stringify(logEntry) + "\n"
    );
  } catch (err) {
    console.error("Failed to write GPT site match log:", err);
  }
  // --- End log ---

  if (result.decision === "match") {
    return { id: fuzzyMatch.id, score: 1, verdict: "accept" };
  } else if (result.decision === "new_site" && result.proposed) {
    // TODO: add new site to lainch-sites.json
    return { id: result.proposed.site_slug, score: 1, verdict: "accept" };
  } else {
    return {...fuzzyMatch, verdict: "no_match" };
  }
}