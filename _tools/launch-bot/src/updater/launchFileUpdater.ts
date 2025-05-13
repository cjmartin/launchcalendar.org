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

  // Log missing fields but continue anyway
  if (!launchData.launch_datetime || !launchData.vehicle || !launchData.payload) {
    console.log("⚠️ Missing one or more fields for launch, will continue anyway:", { date: launchData.launch_datetime, vehicle: launchData.vehicle, payload: launchData.payload });
  }

  const filename = filenameFromLaunchData(launchData);
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

export function filenameFromLaunchData(launchData: LaunchData): string {
  // Helper to simplify slug: use only up to first '(' or '"'
  function simplifySlug(str: string) {
    const match = str.match(/^[^("']+/);
    return match ? match[0].trim() : str;
  }

  const launchDate = launchData.launch_datetime?.slice(0, 10) || "unknown-date";
  const vehicleSlug = slugify(simplifySlug(launchData.vehicle || "unknown-vehicle"), { lower: true });
  const payloadSlug = slugify(simplifySlug(launchData.payload || "unknown-payload"), { lower: true });

  const filename = `${launchDate}-${vehicleSlug}-${payloadSlug}.md`;
  return filename;
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
    "payload-description": launchData.payload_description || "",
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

Sometimes the new launch data will have more accurate or recent information, and sometimes the existing launch data will have more accurate or recent information. Use your best judgment to determine which value to keep. Use all available information to make the best decision, including reliable data sources like wikipedia or the spaceflight now launch schedule.

- Update the existing launchData with new information, merging and deduplicating arrays (tags, links, videos, images), and updating single-value fields (date, time, location, payload, etc.) to the most accurate or recent value.

- For description and article_summary, update the text to reflect any new information, but keep relevant existing details.

- For other fields, be light on updates unless the data is signifigantly improved by the change, unless something is "unknown" or similar it has been reviewed and the existing values are correct. For example, payloads like "Starlink group 15-3" should not be updated to "Starlink 15-3" or "Starlink group 15-3 (28 satellites)".

- Keep details to the description, payload description, and article summary fields. If set in the existing data, the location, vehicle, and payload fields have been reviewed and should be correct.

- For updating and deduplicating the links, videos, and images arrays, pay attention to the url values. There should be no more than one entry in the list for a given url. If there are duplicates, merge them into a single entry.

Return a single JSON object with the updated launchData, using the same structure as LaunchData (see below).\n\nLaunchData structure:
{
  launch_datetime?: string, // the date and time of the scheduled launch in ISO8601 UTC format
  location?: string, // should not be changed from existing
  location_slug?: string, // should not be changed from existing
  manned?: boolean, // is this a manned mission? (true/false)
  vehicle?: string, // should not be changed from existing
  vehicle_type?: string, // most likely 'rocket', but might be missle or other
  vehicle_slug?: string, // should not be changed from existing
  payload?: string, // what is being sent to orbit? (e.g. "Cargo Dragon")
  payload_type?: string, // what type of object is being sent to orbit (e.g. "satellite, cargo module, crew capsule, rideshare")
  payload_description?: string, // a short description of the payload
  description?: string, // a very short description of the launch
  tags?: string[], // a list of tags for this launch, new merged with existing
  article_summary?: string, // a short summary of the launch details, updates, etc.
  links?: LaunchLink[], // Links relevant to this launch, new merged with existing. Pay close attention to the url field, if it is a new link, add it to the list, if it is an existing link, update the title and type list (keeping types unique as well). If the link is not directly relevant to the launch (mission, payload, etc.), remove it from the list.
  videos?: LaunchVideo[], // A list of videos related to the launch, new merged with existing. Pay close attention to the url field, if it is a new video, add it to the list, if it is an existing video, update the title and type list (keeping types unique as well).
  images?: LaunchImage[] // a list of images related to the launch, new merged with existing
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
    "payload-description": updatedLaunchData.payload_description || parsed.data["payload-description"] || "",
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
    payload_description: parsed.data["payload-description"],
    description: parsed.data.description,
    tags: parsed.data.tags,
    links: parsed.data.links,
    videos: parsed.data.videos,
    images: parsed.data.images,
    article_summary: parsed.content,
  };
}
