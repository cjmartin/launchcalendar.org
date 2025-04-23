import { LaunchData } from "../types";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

import slugify from "slugify";

// findExistingLaunch: Finds an existing launch file if it exists
export async function findExistingLaunch(launchData: LaunchData): Promise<string | null> {
  const postsDir = path.resolve(__dirname, "../../../../_posts");
  let files: string[] = [];
  try {
    files = await fs.readdir(postsDir);
  } catch (e) {
    return null;
  }
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const filePath = path.join(postsDir, file);
    // Extract date, vehicle, and payload from filename
    const match = file.match(/^(\d{4}-\d{2}-\d{2})-([a-z0-9-]+)-([a-z0-9-]+)\.md$/i);
    let fileDate = "", fileVehicleSlug = "", filePayloadSlug = "";
    if (match) {
      [, fileDate, fileVehicleSlug, filePayloadSlug] = match;
    }
    const content = await fs.readFile(filePath, "utf8");
    const { data } = matter(content);
    // Prepare launch data for slug comparison
    const launchDate = launchData.launch_datetime?.slice(0, 10);
    const vehicleSlug = slugify(launchData.vehicle || "", { lower: true });
    const payloadSlug = slugify(launchData.payload || "", { lower: true });
    // Match by filename slug and date
    const filenameMatch = launchDate === fileDate && vehicleSlug === fileVehicleSlug && payloadSlug === filePayloadSlug;
    // Fallback to frontmatter match
    const vehicleMatch = (data.vehicle || "").toLowerCase() === (launchData.vehicle || "").toLowerCase();
    const payloadMatch = (data.payload || "").toLowerCase() === (launchData.payload || "").toLowerCase();
    const frontmatterMatch = launchDate && fileDate && launchDate === fileDate && vehicleMatch && payloadMatch;
    if (filenameMatch || frontmatterMatch) {
      return filePath;
    }
  }
  return null;
}
