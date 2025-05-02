// matchUtils.ts
// Generic helpers for fuzzy string matching, normalization, and alias table construction.

import { MatchResult } from "../types";
import { normalize } from "../utils/string";

/**
 * tokenSetScore: Computes Jaccard-style token-set overlap between two strings.
 * Returns a score between 0 and 1 based on the ratio of shared tokens to the max set size.
 */
export const tokenSetScore = (a: string, b: string): number => {
  const A = new Set(normalize(a).split(" "));
  const B = new Set(normalize(b).split(" "));
  return A.size && B.size
    ? [...A].filter((t) => B.has(t)).length / Math.max(A.size, B.size)
    : 0;
};

/**
 * makeAliasTable: Builds a one-way alias-lookup table from canonical items.
 * @param items   Object keyed by canonical id
 * @param aliasFn Function (id, data) => string[] to derive aliases for each item
 * Returns a lookup table mapping normalized aliases to canonical ids.
 */
export function makeAliasTable<T>(
  items: Record<string, T>,
  aliasFn: (data: T) => string[]
): Record<string, string> {
  const table: Record<string, string> = {};
  for (const [id, data] of Object.entries(items))
    for (const alias of aliasFn(data)) table[normalize(alias)] = id;
  return table;
}

/**
 * verdictFromScore: Helper to convert a similarity score to a confidence verdict.
 *   - 'accept' for high confidence (>= 0.85)
 *   - 'gpt_check' for moderate confidence (>= 0.5)
 *   - 'no_match' for low confidence (< 0.5)
 */
export const verdictFromScore = (
  sc: number
): "match" | "gpt_check" | "no_match" =>
  sc >= 0.85 ? "match" : sc >= 0.5 ? "gpt_check" : "no_match";

/**
 * matchStringFuzzy: Attempts to match a raw string to a known entry using the alias table.
 * Returns the best match with a score and verdict.
 * Handles exact matches, common configuration suffixes, and fuzzy matches using token set overlap.
 * @param raw   The raw string to match
 * @param table The alias table to match against
 * @returns A MatchResult object containing the best match id, score, and verdict
 */
export function matchStringFuzzy(
  raw: string,
  table: Record<string, string>
): MatchResult {
  if (!raw) return { id: "", score: 0, verdict: "no_match" };

  const n = normalize(raw);
  if (table[n]) return { id: table[n], score: 1, verdict: "match" };

  let best: { id: string; score: number } = { id: "", score: 0 };
  for (const [alias, id] of Object.entries(table)) {
    const sc = tokenSetScore(n, alias);
    if (sc > best.score) best = { id, score: sc };
  }
  return { ...best, verdict: verdictFromScore(best.score) };
}