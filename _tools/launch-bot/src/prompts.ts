// Centralized prompt strings for OpenAI and related LLM calls

import { RSSEntry } from "./types";

export const DETECT_LAUNCH_PROMPT = (article: RSSEntry) => `Based on the title and description of this article, could the article include information about a rocket launch (flight, mission, etc.)? Reply "yes" or "no".

Title: ${article.title}

Description: ${article.description}

Content Snippet: ${article.contentSnippet}`;

export const EXTRACT_LAUNCH_SYSTEM_PROMPT = `You are a launch data extractor. Your job is to extract launch data from articles. You will be given an article and you need to analyze it for any mentions of rocket launches. If you find any, extract the relevant data as specified below, paying close attention to the description of each piece of data. Important: Respond only with valid JSON. Do not include any extra text or explanation.`;

export const EXTRACT_LAUNCH_USER_PROMPT = (article: RSSEntry) => `Analyze this article and if it mentions one or more launches, extract these pieces of data for each launch, if they are present:

- launch_datetime: The date and time of the scheduled launch in ISO8601 UTC format. This is a very important field and needs to be correct.
- location: What is the launch site? (e.g. SLC-40, Cape Canaveral Air Force Station, Florida)
- manned: Is this a manned mission? (true/false)
- vehicle: What is the launch vehicle? (e.g. Falcon 9, Atlas V, etc.)
- vehicle_type: Most likely 'rocket', but might be missle or other
- payload: What is being sent to orbit? This will be the name of the payload or mission. (e.g. Bandwagon-3, CRS-32 Cargo Dragon, NROL-145, NROL-174, Starlink 6-73, etc.) If a name is not determined, use "unknown" as the value.
- payload_type: What type of object is being sent to orbit? (e.g. satellite, cargo module, crew capsule, classified, etc.) If the payload is classified, use "classified" as the value.
- payload_description: A short description of the payload
- description: A very short description of the launch
- tags: A list of tags for this launch. These should be relevant to the launch and could include things like the vehicle name, payload name, etc.
- article_summary: A summary of the launch details, updates, interesting information, etc. from this article, to be used as the body of the launch file. This shoud be plain text or markdown, if there are relevant links in the article. This should be a summary of the article, not a copy of the article.
- links: A list of links to other RELEVANT pages or articles, not images or other media, with urls about the launch from the article (e.g. the launch page, or any other relevant pages). These should be in the format [{title:string,type:string[],url:string}].
- videos: A list of links with urls to videos related to the launch. Look for youtube embeds, etc. These should be in the format [{title:string,type:string[],source:string,url:string,video_id?:string}]. If the video is from youtube (or another well known service), please return the "watch" url, not the embed url, and include the video_id. 

A few extra details about launch_datetime:
- If there is a day and time but no year, assume the current year: ${new Date().getUTCFullYear()}.
- If the article says something vague like "Tuesday night" but includes a publication date, prefer using that date to resolve the weekday.
- Do not infer the launch date from image filenames unless explicitly stated in the text.
- Ignore any filename-derived dates unless directly referenced in the article body.

Return the data as a json object with the keys as the above names. If there are multiple launches, return an array of objects.
If there are no launches, return an empty array.

Here is the article:

Title: ${article.title}

Publication Date: ${article.pubDate}

Content: ${article.content}`;

export const UPDATE_LAUNCH_SYSTEM_PROMPT = `You are a helpful assistant for updating launch data.`;

export const UPDATE_LAUNCH_USER_PROMPT = `You are a launch data update assistant. Your job is to update and improve launch data for a space launch event.

You will be given two objects:
1. The existing launchData (as JSON)
2. New launchData (as JSON)

Update the existing launchData with the new information, merging and deduplicating arrays (tags, links, videos, images), and updating single-value fields (date, time, location, payload, etc.) to the most accurate or recent value.

For description and article_summary, update the text to reflect any new information, but keep relevant existing details.

Return a single JSON object with the updated launchData, using the same structure as LaunchData (see below).

LaunchData structure:
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
  links?: LaunchLink[], // links relevant to this launch, new merged with existing
  videos?: LaunchVideo[], // a list of videos related to the launch, new merged with existing
  images?: LaunchImage[] // a list of images related to the launch, new merged with existing
}

Here is the existing launchData:
{{EXISTING_LAUNCH_DATA}}

Here is the new launchData:
{{NEW_LAUNCH_DATA}}

Return only the updated LaunchData as JSON. Do not include any extra text or explanation.`;

