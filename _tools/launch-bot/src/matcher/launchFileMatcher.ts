// launchFileMatcher.ts
// Matches extracted launch data to existing launch files using fuzzy string matching and date proximity.
// Uses normalization and token set scoring utilities for robust matching.

import { LaunchData, LaunchMatchResult } from "../types";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { normalize, tokenSetScore } from "./matchUtils";

// Checks if two dates are close (same day or within 2 hours)
function isDateClose(date1?: string, date2?: string): boolean {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  ) return true;
  return Math.abs(d1.getTime() - d2.getTime()) <= 2 * 60 * 60 * 1000;
}

// Attempts to find an existing launch file that matches the provided launch data.
// Compares vehicle, payload, and location using token set overlap, and checks date proximity.
// Returns a match result with confidence score and file path if found.
export async function findExistingLaunch(
  launchData: LaunchData
): Promise<LaunchMatchResult> {
  const postsDir = path.resolve(__dirname, "../../../../_posts");
  const draftsDir = path.resolve(__dirname, "../../../../_drafts");
  let files: { file: string; dir: string }[] = [];
  try {
    const postFiles = (await fs.readdir(postsDir)).filter(f => f.endsWith(".md")).map(f => ({ file: f, dir: postsDir }));
    let draftFiles: { file: string; dir: string }[] = [];
    try {
      draftFiles = (await fs.readdir(draftsDir)).filter(f => f.endsWith(".md")).map(f => ({ file: f, dir: draftsDir }));
    } catch {}
    files = [...postFiles, ...draftFiles];
  } catch {
    return { matched: false, reason: "none", confidence: 0 };
  }

  const normVehicle = normalize(launchData.vehicle || "");
  const normPayload = normalize(launchData.payload || "");
  const normLocation = normalize(launchData.location || "");

  for (const { file, dir } of files) {
    const filePath = path.join(dir, file);
    const content = await fs.readFile(filePath, "utf8");
    const { data, content: oldPostBody } = matter(content);

    const fileVehicle = normalize(data.vehicle || "");
    const filePayload = normalize(data.payload || "");
    const fileLocation = normalize(data.location || "");

    const vehicleScore = tokenSetScore(normVehicle, fileVehicle);
    const payloadScore = tokenSetScore(normPayload, filePayload);
    const locationScore = tokenSetScore(normLocation, fileLocation);

    const matchScore = (vehicleScore + payloadScore + locationScore) / 3;

    const dateClose = isDateClose(launchData.launch_datetime, data.date);
    if (matchScore >= 0.8 && dateClose) {
      return {
        matched: true,
        reason: "identity",
        existingPath: filePath,
        confidence: matchScore
      };
    }

    if (matchScore >= 0.8 && !dateClose) {
      // This will become the hook for AI-assisted post comparison
      // For now, we don’t trust it enough without the AI layer
      continue;
    }
  }

  return { matched: false, reason: "none", confidence: 0 };
}