// Matcher for launch site names to canonical site IDs.
// Loads a table of site aliases and provides a function to match raw site names to known sites.

import { readFile } from "fs/promises";
import path from "path";
import {
  normalize, // Normalizes strings for comparison
  tokenSetScore, // Computes similarity score between two strings
  makeAliasTable, // Builds a lookup table of aliases to IDs
  verdictFromScore, // Converts a score to a match verdict
} from "./matchUtils";
import { LaunchSite, MatchResult } from "../types";

// Interface for the result of a site match attempt
export interface SiteMatch { site_id?: string; score: number; verdict: ReturnType<typeof verdictFromScore>; }

/* ---------- one-time table build ---------- */

// Loads the launch site table from a JSON file.
// Each site entry generates a list of possible aliases, including algorithmic expansions for common naming patterns.
export async function loadSiteTable(
  jsonPath = path.resolve("_data/launch-sites.json")
) {
  const raw = JSON.parse(await readFile(jsonPath, "utf8"));
  return makeAliasTable(raw, (entry: LaunchSite) => {
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
}

/* ---------- matcher ---------- */

// Attempts to match a raw site name to a known site using the alias table.
// Returns the best match with a score and verdict.
export function matchSite(
  raw: string | undefined,
  table: Record<string, string>
): MatchResult {
  if (!raw) return { id: "", score: 0, verdict: "no_match" };

  const n = normalize(raw);
  if (table[n]) return { id: table[n], score: 1, verdict: "accept" };

  let best: { id: string; score: number } = { id: "", score: 0 };
  for (const [alias, id] of Object.entries(table)) {
    const sc = tokenSetScore(n, alias);
    if (sc > best.score) best = { id, score: sc };
  }
  return { ...best, verdict: verdictFromScore(best.score) };
}