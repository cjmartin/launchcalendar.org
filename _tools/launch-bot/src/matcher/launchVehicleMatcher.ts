// launchVehicleMatcher.ts
// Provides functions to load a table of launch vehicle aliases and match raw vehicle names to canonical vehicle IDs.
// Uses fuzzy string matching and normalization to handle variations in vehicle naming.

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  tokenSetScore, // Computes similarity score between two strings
  makeAliasTable, // Builds a lookup table of aliases to IDs
  verdictFromScore, // Converts a score to a match verdict
} from "./matchUtils";
import { LaunchVehicle, MatchResult } from "../types";
import { normalize } from "../utils/string";

const knownLaunchVehiclesFilePath = path.resolve(__dirname, "../../data/launch-vehicles.json");
const knownLaunchVehicles = async () => JSON.parse(await readFile(knownLaunchVehiclesFilePath, "utf8"));

// Loads the launch vehicle alias table from a JSON file.
// Each vehicle entry generates a list of possible aliases, including the main name and any provided aliases.
export async function loadVehicleTable(
  knownVehicles?: Record<string, LaunchVehicle>
) {
  if (!knownVehicles) {
    knownVehicles = await knownLaunchVehicles();
    if (!knownVehicles) throw new Error("Failed to load known launch vehicles");
    console.log("📄 Loaded known launch vehicles");
  }

  return makeAliasTable(knownVehicles, (entry: LaunchVehicle) => [
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
): MatchResult {
  if (!raw) {
    console.log("❌ No vehicle name provided");
    return { id: "", score: 0, verdict: "no_match" };
  }

  console.log(`🔍 Attempting to match vehicle: '${raw}'`);
  const n = normalize(raw);
  if (table[n]) {
    console.log(`🧐 Exact match found: ${table[n]}`);
    return { id: table[n], score: 1, verdict: "match" };
  }

  // strip trailing config block (Atlas V 551 → Atlas V)
  const base = n.replace(/\s+\d+[a-z]*$/i, "");
  if (base !== n && table[base]) {
    console.log(`🧐 Matched after stripping config: ${table[base]}`);
    return { id: table[base], score: 0.92, verdict: "match" };
  }

  let best: { id: string; score: number } = {id: "", score: 0 };
  for (const [alias, id] of Object.entries(table)) {
    const sc = tokenSetScore(n, alias);
    if (sc > best.score) best = { id, score: sc };
  }
  console.log(`🧐 Fuzzy match: id=${best.id}, score=${best.score}`);
  return { ...best, verdict: verdictFromScore(best.score) };
}