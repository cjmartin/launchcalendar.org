// launchVehicleMatcher.ts
// Provides functions to load a table of launch vehicle aliases and match raw vehicle names to canonical vehicle IDs.
// Uses fuzzy string matching and normalization to handle variations in vehicle naming.

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  normalize, // Normalizes strings for comparison
  tokenSetScore, // Computes similarity score between two strings
  makeAliasTable, // Builds a lookup table of aliases to IDs
  verdictFromScore, // Converts a score to a match verdict
} from "./matchUtils";

// Interface for the result of a vehicle match attempt
export interface VehicleMatch { vehicle_id?: string; score: number; verdict: ReturnType<typeof verdictFromScore>; }

// Loads the launch vehicle alias table from a JSON file.
// Each vehicle entry generates a list of possible aliases, including the main name and any provided aliases.
export async function loadVehicleTable(
  jsonPath = path.resolve("_data/launch-vehicles.json")
) {
  const raw = JSON.parse(await readFile(jsonPath, "utf8"));
  return makeAliasTable(raw, (_id, entry: any) => [
    entry.vehicle_name, // Main vehicle name
    ...(entry.aliases ?? []), // Additional aliases
  ]);
}

// Attempts to match a raw vehicle name to a known vehicle using the alias table.
// Handles exact matches, common configuration suffixes, and fuzzy matches using token set overlap.
// Returns the best match with a score and verdict.
export function matchVehicle(
  raw: string | undefined,
  table: Record<string, string>
): VehicleMatch {
  if (!raw) return { score: 0, verdict: "no_match" };

  const n = normalize(raw);
  if (table[n]) return { vehicle_id: table[n], score: 1, verdict: "accept" };

  // strip trailing config block (Atlas V 551 → Atlas V)
  const base = n.replace(/\s+\d+[a-z]*$/i, "");
  if (base !== n && table[base])
    return { vehicle_id: table[base], score: 0.92, verdict: "accept" };

  let best: { id?: string; score: number } = { score: 0 };
  for (const [alias, id] of Object.entries(table)) {
    const sc = tokenSetScore(n, alias);
    if (sc > best.score) best = { id, score: sc };
  }
  return { ...best, verdict: verdictFromScore(best.score) };
}