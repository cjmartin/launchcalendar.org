// launchFileMatcher.ts
// Matches extracted launch data to existing launch files using fuzzy string matching and date proximity.
// Uses normalization and token set scoring utilities for robust matching.

import { LaunchData, LaunchMatchResult } from "../types";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { tokenSetScore } from "./matchUtils";
import slugify from "slugify";
import { isSameDay, isWithinDays } from "../utils/date";
import { fileDataToLaunchData } from "../updater/launchFileUpdater";
import { normalize } from "../utils/string";

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
    console.log(`📄 Found ${files.length} launch files to check for matches.`);
  } catch {
    console.log("❌ Could not read _posts or _drafts directory.");
    return { matched: false, reason: "no_match", confidence: 0 };
  }

  const normVehicle = launchData.vehicle_slug || slugify(normalize(launchData.vehicle || ""));
  const normLocation = launchData.location_slug || slugify(normalize(launchData.location || ""));
  const normPayload = normalize(launchData.payload || "");

  console.log(`🔍 Normalized vehicle: ${normVehicle}, location: ${normLocation}, payload: ${normPayload}`);

  for (const { file, dir } of files) {
    const filePath = path.join(dir, file);
    const content = await fs.readFile(filePath, "utf8");
    const parsed = matter(content);
    const fileLaunchData = fileDataToLaunchData(parsed);

    const fileVehicle = fileLaunchData.vehicle_slug || slugify(normalize(fileLaunchData.vehicle || ""));
    const fileLocation = fileLaunchData.location_slug || slugify(normalize(fileLaunchData.location || ""));
    const filePayload = normalize(fileLaunchData.payload || "");

    const vehicleScore = tokenSetScore(normVehicle, fileVehicle);
    const payloadScore = tokenSetScore(normPayload, filePayload);
    const locationScore = tokenSetScore(normLocation, fileLocation);

    const locationVehicleScore = (vehicleScore + locationScore) / 2;
    const fullScore = (vehicleScore + locationScore + payloadScore) / 3;

    const sameDay = isSameDay(launchData.launch_datetime, fileLaunchData.launch_datetime);
    const dateClose = isWithinDays(launchData.launch_datetime, fileLaunchData.launch_datetime, 5);

    // Only log details for files that match or potentially match
    if (
      (locationVehicleScore >= 0.8 && sameDay) ||
      (locationVehicleScore >= 0.8 && dateClose) ||
      (fullScore >= 0.5)
    ) {
      console.log(`📂 Checking file: ${filePath}`);
      console.log(`   → Normalized vehicle: ${fileVehicle}, location: ${fileLocation}, payload: ${filePayload}`);
      console.log(`   → Vehicle score: ${vehicleScore.toFixed(2)}, Location score: ${locationScore.toFixed(2)}, Payload score: ${payloadScore.toFixed(2)}`);
      console.log(`   → Location+Vehicle avg: ${locationVehicleScore.toFixed(2)}, Full score: ${fullScore.toFixed(2)}`);
    }

    if (locationVehicleScore >= 0.8 && sameDay) {
      console.log(`✅ Strong match (update): ${filePath}`);
      return {
        matched: true,
        reason: "update",
        existingPath: filePath,
        confidence: locationVehicleScore
      };
    }
    
    if (locationVehicleScore >= 0.8 && dateClose) {
      console.log(`🔄 Possible reschedule match: ${filePath}`);
      console.log(`   → Launch date: ${launchData.launch_datetime}, File date: ${fileLaunchData.launch_datetime}`);
      return {
        matched: true,
        reason: "reschedule",
        existingPath: filePath,
        confidence: locationVehicleScore
      };
    }

    if (fullScore >= 0.75) {
      console.log(`🤔 Potential match (needs AI check): ${filePath}`);
      continue;
    }
  }

  console.log("🆕 No matching launch file found.");
  return { matched: false, reason: "no_match", confidence: 0 };
}