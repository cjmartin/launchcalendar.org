import { LaunchData, LaunchMatchResult } from "../types";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

// Token overlap for simple fuzzy match (can be replaced with better scoring later)
function scoreMatch(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/[\s\-_,.()]+/));
  const tokensB = new Set(b.toLowerCase().split(/[\s\-_,.()]+/));
  const intersection = [...tokensA].filter(x => tokensB.has(x));
  return intersection.length / Math.max(tokensA.size, tokensB.size);
}

function normalize(str = ""): string {
  return str
    .replace(/(group|mission|batch|satellites?|v\d+|mini|optimized|starlink|launch)?/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

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

export async function findExistingLaunch(
  launchData: LaunchData
): Promise<LaunchMatchResult> {
  const postsDir = path.resolve(__dirname, "../../../../_posts");
  let files: string[] = [];
  try {
    files = await fs.readdir(postsDir);
  } catch {
    return { matched: false, reason: "none", confidence: 0 };
  }

  const normVehicle = normalize(launchData.vehicle || "");
  const normPayload = normalize(launchData.payload || "");
  const normLocation = normalize(launchData.location || "");

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const filePath = path.join(postsDir, file);
    const content = await fs.readFile(filePath, "utf8");
    const { data, content: oldPostBody } = matter(content);

    const fileVehicle = normalize(data.vehicle || "");
    const filePayload = normalize(data.payload || "");
    const fileLocation = normalize(data.location || "");

    const vehicleScore = scoreMatch(normVehicle, fileVehicle);
    const payloadScore = scoreMatch(normPayload, filePayload);
    const locationScore = scoreMatch(normLocation, fileLocation);

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