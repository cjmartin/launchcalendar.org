import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import slugify from "slugify";
import { frontMatterKeys, LaunchData, LaunchFrontmatter, LaunchMatchResult } from "../types";

// updateOrCreateLaunchFile: Updates or creates a launch file
export async function updateOrCreateLaunchFile(matchResult: LaunchMatchResult, launchData: LaunchData): Promise<void> {
  const existingFilePath = matchResult.existingPath;
  const draftsDir = path.resolve(__dirname, "../../../../_drafts");

  const launchDate = launchData.launch_datetime?.slice(0, 10);

  // Helper to simplify slug: use only up to first '(' or '"'
  function simplifySlug(str: string) {
    const match = str.match(/^[^("']+/);
    return match ? match[0].trim() : str;
  }

  const vehicleSlug = slugify(simplifySlug(launchData.vehicle || ""), { lower: true });
  const payloadSlug = slugify(simplifySlug(launchData.payload || ""), { lower: true });

  // Prevent file creation if required fields are missing
  if (!launchDate || !vehicleSlug || !payloadSlug) {
    console.error("🚫 Missing required fields for file creation:", { launchDate, vehicleSlug, payloadSlug });
    return;
  }
  const filename = `${launchDate}-${vehicleSlug}-${payloadSlug}.md`;
  const filePath = existingFilePath || path.join(draftsDir, filename);

  let content = "";
  if (existingFilePath) {
    // Update existing file
    content = await fs.readFile(filePath, "utf8");
    const parsed = matter(content);
    // Merge launchData into frontmatter
    content = updateLaunchFile(parsed, launchData);
  } else {
    // Create new file
    content = createLaunchFile(filePath, launchData);
  }
  await fs.writeFile(filePath, content, "utf8");
}

/**
 * Creates a new launch file with the provided launch data.
 * @param filePath The path where the new file should be created
 * @param launchData The launch data to use for the file
 * @returns The markdown string to be written to the file
 */
export function createLaunchFile(filePath: string, launchData: LaunchData): string {
  const frontmatter: LaunchFrontmatter = {
    layout: "launch",
    title: `🚀 ${launchData.vehicle || ""} | 🛰 ${launchData.payload || ""}`.trim(),
    description: launchData.description || "",
    tags: launchData.tags || [],
    date: launchData.launch_datetime || "",
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    location: launchData.location || "",
    manned: launchData.manned || false,
    vehicle: launchData.vehicle || "",
    "vehicle-type": launchData.vehicle_type || "",
    payload: launchData.payload || "",
    "payload-type": launchData.payload_type || "",
    links: launchData.links || [],
    videos: launchData.videos || [],
    images: launchData.images || [],
  };
  // Provide a default body for new files
  const body = launchData.article_summary || "\n";
  return matter.stringify(body, frontmatter);
}

/**
 * Updates the frontmatter and body of a parsed markdown file with new launch data.
 * Only valid LaunchFrontmatter keys are updated. The body is replaced with launchData.article_summary if present.
 * @param parsed The result of gray-matter(content) for the file
 * @param launchData The new launch data to update with
 * @returns The updated markdown string
 */
export function updateLaunchFile(parsed: any, launchData: LaunchData): string {
  // Merge and filter only allowed frontmatter keys
  const merged = { ...parsed.data, ...launchData };
  const updatedFrontmatter = Object.fromEntries(
    frontMatterKeys
      .map(key => (merged[key] ? [key, merged[key]] : undefined))
      .filter((entry): entry is [string, any] => entry !== undefined)
  );
  // Update the body to article_summary if present, else keep existing
  const updatedBody = launchData.article_summary || parsed.content;
  console.log("Updated frontmatter:", updatedFrontmatter);
  console.log("Updated body:", updatedBody);
  return matter.stringify(updatedBody, updatedFrontmatter);
}
