import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
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
    // Update existing file
    content = await fs.readFile(filePath, "utf8");
    const parsed = matter(content);
    // Merge launchData into frontmatter
    content = await updateLaunchFile(parsed, launchData);
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
 * Updates the launch data of a parsed markdown file using GPT-4.1.
 * Passes the existing and new LaunchData to GPT to intelligently merge/update all fields.
 * @param parsed The result of gray-matter(content) for the file
 * @param launchData The new launch data to update with
 * @returns The updated markdown string
 */
export async function updateLaunchFile(parsed: any, launchData: LaunchData): Promise<string> {
  const existingLaunchData = fileDataToLaunchData(parsed);

  // Prepare prompt
  const prompt = `You are a launch data update assistant. Your job is to update and improve launch data for a space launch event.\n\nYou will be given two objects:\n1. The existing launchData (as JSON)\n2. New launchData (as JSON)\n\nUpdate the existing launchData with the new information, merging and deduplicating arrays (tags, links, videos, images), and updating single-value fields (date, time, location, payload, etc.) to the most accurate or recent value.\n\nFor description and article_summary, update the text to reflect any new information, but keep relevant existing details.\n\nReturn a single JSON object with the updated launchData, using the same structure as LaunchData (see below).\n\nLaunchData structure:\n{\n  launch_datetime?: string,\n  location?: string,\n  manned?: boolean,\n  vehicle?: string,\n  vehicle_type?: string,\n  payload?: string,\n  payload_type?: string,\n  description?: string,\n  tags?: string[],\n  article_summary?: string,\n  links?: LaunchLink[],\n  videos?: LaunchVideo[],\n  images?: LaunchImage[]\n}\n\nHere is the existing launchData:\n${JSON.stringify(existingLaunchData, null, 2)}\n\nHere is the new launchData:\n${JSON.stringify(launchData, null, 2)}\n\nReturn only the updated LaunchData as JSON. Do not include any extra text or explanation.`;

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
    location: updatedLaunchData.location || parsed.data.location || "",
    manned: typeof updatedLaunchData.manned === 'boolean' ? updatedLaunchData.manned : (typeof parsed.data.manned === 'boolean' ? parsed.data.manned : false),
    vehicle: updatedLaunchData.vehicle || parsed.data.vehicle || "",
    "vehicle-type": updatedLaunchData.vehicle_type || parsed.data["vehicle-type"] || "",
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
export function fileDataToLaunchData(parsed: { data: LaunchFrontmatter, content: string }): LaunchData {
  return {
    launch_datetime: parsed.data.date,
    location: parsed.data.location,
    manned: parsed.data.manned,
    vehicle: parsed.data.vehicle,
    vehicle_type: parsed.data["vehicle-type"],
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
