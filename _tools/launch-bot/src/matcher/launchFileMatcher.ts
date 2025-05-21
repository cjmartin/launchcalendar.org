// launchFileMatcher.ts
// Matches extracted launch data to existing launch files using fuzzy string matching and date proximity.
// Uses normalization and token set scoring utilities for robust matching.

import { LaunchData, launchFileGPTMatch, LaunchMatchResult } from "../types";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { tokenSetScore } from "./matchUtils";
import slugify from "slugify";
import { isSameDay, isWithinDays } from "../utils/date";
import { fileDataToLaunchData } from "../updater/launchFileUpdater";
import { normalize } from "../utils/string";
import { callOpenAI } from "../utils/openai";

// Attempts to find an existing launch file that matches the provided launch data.
// Compares vehicle, payload, and location using token set overlap, and checks date proximity.
// Returns a match result with confidence score and file path if found.
export async function findExistingLaunch(
  launchData: LaunchData,
  status: 'update' | 'new'
): Promise<LaunchMatchResult> {
  const postsDir = path.resolve(__dirname, "../../../../_posts");
  const draftsDir = path.resolve(__dirname, "../../../../_drafts");
  const draftsFutureDir = path.resolve(draftsDir, "future");
  const draftsPastDir = path.resolve(draftsDir, "past");
  let files: { file: string; dir: string }[] = [];
  try {
    const postFiles = (await fs.readdir(postsDir)).filter(f => f.endsWith(".md")).map(f => ({ file: f, dir: postsDir }));
    let draftFiles: { file: string; dir: string }[] = [];
    try {
      // Read _drafts root
      draftFiles = (await fs.readdir(draftsDir)).filter(f => f.endsWith(".md")).map(f => ({ file: f, dir: draftsDir }));
      // Read _drafts/future
      try {
        const futureFiles = (await fs.readdir(draftsFutureDir)).filter(f => f.endsWith(".md")).map(f => ({ file: f, dir: draftsFutureDir }));
        draftFiles = draftFiles.concat(futureFiles);
      } catch {}
      // Read _drafts/past
      try {
        const pastFiles = (await fs.readdir(draftsPastDir)).filter(f => f.endsWith(".md")).map(f => ({ file: f, dir: draftsPastDir }));
        draftFiles = draftFiles.concat(pastFiles);
      } catch {}
    } catch {}
    // Sort files in reverse chronological order based on filename (assumes YYYY-MM-DD at start)
    files = [...postFiles, ...draftFiles].sort((a, b) => {
      // Extract date part (first 10 chars)
      const dateA = a.file.substring(0, 10);
      const dateB = b.file.substring(0, 10);
      // Compare as strings (lexicographical, so YYYY-MM-DD works)
      if (dateA < dateB) return 1;
      if (dateA > dateB) return -1;
      return 0;
    });
    console.log(`📄 Found ${files.length} launch files to check for matches.`);
  } catch {
    console.log("❌ Could not read _posts or _drafts directory.");
    return { match: false, type: "no_match", confidence: 0 };
  }

  const normVehicle = launchData.vehicle_slug || slugify(normalize(launchData.vehicle || ""));
  const normLocation = launchData.location_slug || slugify(normalize(launchData.location || ""));
  const normPayload = normalize(launchData.payload || "");

  console.log(`🔍 Launch date: ${launchData.launch_datetime}, Normalized vehicle: ${normVehicle}, location: ${normLocation}, payload: ${normPayload}`);

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

    const sameDay = isSameDay(fileLaunchData.launch_datetime, launchData.launch_datetime);
    const dateClose = isWithinDays(fileLaunchData.launch_datetime, launchData.launch_datetime, 5);

    // Only log details for files that match or potentially match
    if (
      (locationVehicleScore >= 0.8 && sameDay) ||
      (locationVehicleScore >= 0.8 && dateClose) ||
      (fullScore >= 0.85)
    ) {
      console.log(`📂 Checking file: ${filePath}`);
      console.log(`   → Launch date: ${fileLaunchData.launch_datetime}, File date: ${launchData.launch_datetime}`);
      console.log(`   → Dates are same day: ${sameDay}, Dates are close: ${dateClose}`);
      console.log(`   → Normalized vehicle: ${fileVehicle}, location: ${fileLocation}, payload: ${filePayload}`);
      console.log(`   → Vehicle score: ${vehicleScore.toFixed(2)}, Location score: ${locationScore.toFixed(2)}, Payload score: ${payloadScore.toFixed(2)}`);
      console.log(`   → Location+Vehicle avg: ${locationVehicleScore.toFixed(2)}, Full score: ${fullScore.toFixed(2)}`);
    }

    let isUpdate: launchFileGPTMatch | undefined;
    if (locationVehicleScore >= 0.8 && sameDay) {
      console.log(`✅ Strong match (update): ${filePath}`);
      // Get GPT to take a look at the file + new data and confirm that it's an update match.
      isUpdate = await gptCheckMatch(fileLaunchData, launchData, status);
    } else if (locationVehicleScore >= 0.8 && dateClose) {
      console.log(`🔄 Possible reschedule match: ${filePath}`);
      console.log(`   → Launch date: ${launchData.launch_datetime}, File date: ${fileLaunchData.launch_datetime}`);
      // Get GPT to take a look at the file + new data and confirm that it's a reschedule match.
      isUpdate = await gptCheckMatch(fileLaunchData, launchData, status);
    } else if (fullScore >= 0.85) {
      console.log(`🤔 Potential match due to location/vehicle/payload fuzzy match score: ${filePath}`);
      // Get GPT to take a look at the file + new data and confirm that it's a match.
      isUpdate = await gptCheckMatch(fileLaunchData, launchData, status);
    }

    if (isUpdate?.match) {
      return {
        match: true,
        type: isUpdate.type,
        existingPath: filePath,
        confidence: locationVehicleScore
      };
    }
  }

  console.log("🆕 No matching launch file found.");
  return { match: false, type: "no_match", confidence: 0 };
}

async function gptCheckMatch(fileLaunchData: LaunchData, launchData: LaunchData, articleStatus: 'update' | 'new'): Promise<launchFileGPTMatch> {
  const prompt = `You are a helpful assistant for verifying launch data matches.
You will be given two objects:
1. The existing launch data (as JSON)
2. The new launch data (as JSON)

Respond with a JSON object with the following keys:
- "match": true if the new launch data is an update to the existing launch data, or if it is an exact match (no update needed). False otherwise.
- "type": "update" if the new launch data is an update, "reschedule" if the new launch data is a reschedule, "no_update" if the new launch data matches the existing launch data but there is no significant update or new information, or "no_match" if it is not a match.
- "reasoning": a short explanation of how you arrived at your decision.

This launch data came from an article. The article is either new, or being reprocessed because it has changed in some way.

The source article status for this launch is: "${articleStatus}"

If the article status is "update", there must be significant new updates in the launch data to warrant an "update" or "reschedule" type. If it seems like the article might have been updated but not this specific launch (very common), the type should be "no_update".
If the article status is "new", the type should "update" if there is new information about the launch, or "reschedule" if the launch data is a reschedule.

Here is the existing launch data:
${JSON.stringify(fileLaunchData, null, 2)}

Here is the new launch data:
${JSON.stringify(launchData, null, 2)}

Return only JSON matching this schema:
{
  "match": boolean,
  "type": "update" | "reschedule" | "no_match" | "no_update",
  "reasoning": string
}

Do not include any extra text or explanation.`;

  const result = await callOpenAI([
    { role: 'system', content: 'You are a helpful assistant for verifying launch data matches. Important: Respond only with valid JSON. Do not include any extra text or explanation.' },
    { role: 'user', content: prompt }
  ]);

  try {
    const parsed = JSON.parse(result);
    if (typeof parsed.match === "boolean" && parsed.type && parsed.reasoning) {
      console.log(`   → GPT match result: ${parsed.type}`);
      console.log(`   → GPT reasoning: ${parsed.reasoning}`);
      return parsed as launchFileGPTMatch;
    }
  }
  catch (error) {
    console.error('Failed to parse gptCheckMatch JSON response:', error);
    console.error('Response:', result);
  }
  return { match: false, type: "no_match", reasoning: "Failed to parse GPT response" };
}