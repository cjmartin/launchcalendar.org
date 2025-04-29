import fs from "fs/promises";
import path from "path";
import matter, { GrayMatterFile } from "gray-matter";
import slugify from "slugify";
import { LaunchData, LaunchFrontmatter, LaunchMatchResult } from "../types";
import { callOpenAI } from "../utils/openai";

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
    // Merge launchData into frontmatter
    content = await updateLaunchFile(existingFilePath, launchData);
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
 * @param created Optional created date for the file (ISO format, for front matter)
 * @returns The markdown string to be written to the file
 */
export function createLaunchFile(filePath: string, launchData: LaunchData, created?: string): string {
  const now = new Date().toISOString();
  const frontmatter: LaunchFrontmatter = {
    layout: "launch",
    title: `🚀 ${launchData.vehicle || ""} | 🛰 ${launchData.payload || ""}`.trim(),
    description: launchData.description || "",
    tags: launchData.tags || [],
    date: launchData.launch_datetime || "",
    created: created || now,
    updated: now,
    redirect_from: [],
    location: launchData.location || "",
    "location-slug": launchData.location_slug || "",
    manned: launchData.manned || false,
    vehicle: launchData.vehicle || "",
    "vehicle-type": launchData.vehicle_type || "",
    "vehicle-slug": launchData.vehicle_slug || "",
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
 * Updates the launch data of a parsed markdown file using GPT.
 * Passes the existing and new LaunchData to GPT to intelligently merge/update all fields.
 * @param parsed The result of gray-matter(content) for the file
 * @param launchData The new launch data to update with
 * @returns The updated markdown string
 */
export async function updateLaunchFile(filePath: string, launchData: LaunchData): Promise<string> {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = matter(content);

  const existingLaunchData = fileDataToLaunchData(parsed);

  // Prepare prompt
  const prompt = `You are a launch data update assistant. Your job is to update and improve launch data for a space launch event.

You will be given two objects:
1. The existing launchData (as JSON)
2. New launchData (as JSON)

Update the existing launchData with the new information, merging and deduplicating arrays (tags, links, videos, images), and updating single-value fields (date, time, location, payload, etc.) to the most accurate or recent value.

For description and article_summary, update the text to reflect any new information, but keep relevant existing details.

Return a single JSON object with the updated launchData, using the same structure as LaunchData (see below).\n\nLaunchData structure:
{
  launch_datetime?: string,
  location?: string,
  location_slug?: string,
  manned?: boolean,
  vehicle?: string,
  vehicle_type?: string,
  vehicle_slug?: string,
  payload?: string,
  payload_type?: string,
  description?: string,
  tags?: string[],
  article_summary?: string,
  links?: LaunchLink[],
  videos?: LaunchVideo[],
  images?: LaunchImage[]
}

Here is the existing launchData:
${JSON.stringify(existingLaunchData, null, 2)}

Here is the new launchData:
${JSON.stringify(launchData, null, 2)}

Return only the updated LaunchData as JSON. Do not include any extra text or explanation.`;

  const gptResponse = await callOpenAI([
    { role: "system", content: "You are a helpful assistant for updating launch data." },
    { role: "user", content: prompt }
  ]);

  let updatedLaunchData: LaunchData;
  try {
    updatedLaunchData = JSON.parse(gptResponse);
  } catch (e) {
    throw new Error("Failed to parse GPT response as JSON: " + gptResponse);
  }

  // Rebuild frontmatter from updatedLaunchData and preserve non-launchData fields from parsed.data
  const frontmatter: LaunchFrontmatter = {
    layout: parsed.data.layout,
    title: `🚀 ${updatedLaunchData.vehicle || parsed.data.vehicle || ""} | 🛰 ${updatedLaunchData.payload || parsed.data.payload || ""}`.trim(),
    description: updatedLaunchData.description || parsed.data.description || "",
    tags: updatedLaunchData.tags || parsed.data.tags || [],
    date: updatedLaunchData.launch_datetime || parsed.data.date || "",
    created: parsed.data.created,
    updated: new Date().toISOString(),
    redirect_from: parsed.data.redirect_from || [],
    location: updatedLaunchData.location || parsed.data.location || "",
    "location-slug": updatedLaunchData.location_slug || parsed.data["location-slug"] || "",
    manned: typeof updatedLaunchData.manned === 'boolean' ? updatedLaunchData.manned : (typeof parsed.data.manned === 'boolean' ? parsed.data.manned : false),
    vehicle: updatedLaunchData.vehicle || parsed.data.vehicle || "",
    "vehicle-type": updatedLaunchData.vehicle_type || parsed.data["vehicle-type"] || "",
    "vehicle-slug": updatedLaunchData.vehicle_slug || parsed.data["vehicle-slug"] || "",
    payload: updatedLaunchData.payload || parsed.data.payload || "",
    "payload-type": updatedLaunchData.payload_type || parsed.data["payload-type"] || "",
    links: updatedLaunchData.links || parsed.data.links || [],
    videos: updatedLaunchData.videos || parsed.data.videos || [],
    images: updatedLaunchData.images || parsed.data.images || [],
  };

  // For the body, use updatedLaunchData.article_summary if present, else keep existing
  const updatedBody = updatedLaunchData.article_summary || parsed.content;
  return matter.stringify(updatedBody, frontmatter);
}

/**
 * Converts parsed file data (frontmatter + content) to LaunchData.
 * Includes parsed.content as article_summary.
 */
export function fileDataToLaunchData(parsed: GrayMatterFile<string>): LaunchData {
  return {
    launch_datetime: parsed.data.date,
    location: parsed.data.location,
    location_slug: parsed.data["location-slug"],
    manned: parsed.data.manned,
    vehicle: parsed.data.vehicle,
    vehicle_type: parsed.data["vehicle-type"],
    vehicle_slug: parsed.data["vehicle-slug"],
    payload: parsed.data.payload,
    payload_type: parsed.data["payload-type"],
    description: parsed.data.description,
    tags: parsed.data.tags,
    links: parsed.data.links,
    videos: parsed.data.videos,
    images: parsed.data.images,
    article_summary: parsed.content,
  };
}
