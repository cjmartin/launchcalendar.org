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

// Interface for the result of a site match attempt
export interface SiteMatch { site_id?: string; score: number; verdict: ReturnType<typeof verdictFromScore>; }

/* ---------- one-time table build ---------- */

// Loads the launch site table from a JSON file.
// Each site entry generates a list of possible aliases, including algorithmic expansions for common naming patterns.
export async function loadSiteTable(
  jsonPath = path.resolve("_data/launch-sites.json")
) {
  const raw = JSON.parse(await readFile(jsonPath, "utf8"));
  return makeAliasTable(raw, (_id, entry: any) => {
    const list: string[] = [
      entry.site_name, // Main site name
      entry.location, // Location name
      `${entry.site_name}, ${entry.location}`,
    ];

    // algorithmic expansions ----------------------------------
    // Add common variations for SLC and LC site names
    const sn = entry.site_name as string;

    const slc = sn.match(/^SLC-(\d+)([EW])?$/i);
    if (slc) {
      const [, num, ew] = slc;
      const dir = ew === "E" ? "East" : ew === "W" ? "West" : "";
      list.push(`Space Launch Complex ${num} ${dir}`.trim());
      list.push(`Launch Complex ${num} ${dir}`.trim());
    }
    const lc = sn.match(/^LC-(\d+[A-Z]?)$/i);
    if (lc) list.push(`Launch Complex ${lc[1]}`);

    return list;
  });
}

/* ---------- matcher ---------- */

// Attempts to match a raw site name to a known site using the alias table.
// Returns the best match with a score and verdict.
export function matchSite(
  raw: string | undefined,
  table: Record<string, string>
): SiteMatch {
  if (!raw) return { score: 0, verdict: "no_match" };

  const n = normalize(raw);
  if (table[n]) return { site_id: table[n], score: 1, verdict: "accept" };

  let best: { id?: string; score: number } = { score: 0 };
  for (const [alias, id] of Object.entries(table)) {
    const sc = tokenSetScore(n, alias);
    if (sc > best.score) best = { id, score: sc };
  }
  return { ...best, verdict: verdictFromScore(best.score) };
}