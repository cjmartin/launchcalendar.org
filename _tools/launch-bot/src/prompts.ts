// Centralized prompt strings for OpenAI and related LLM calls

import { RSSEntry } from "./types";

export const DETECT_LAUNCH_PROMPT = (article: RSSEntry) => `Based on the title and description of this article, could the article include information about a rocket launch (flight, mission, etc.)? Reply "yes" or "no".

Title: ${article.title}

Description: ${article.description}

Content Snippet: ${article.contentSnippet}`;

export const EXTRACT_LAUNCH_SYSTEM_PROMPT = `You are a launch data extractor. Your job is to extract launch data from articles. You will be given an article and you need to analyze it for any mentions of rocket launches. If you find any, extract the relevant data as specified below, paying close attention to the description of each piece of data. Important: Respond only with valid JSON. Do not include any extra text or explanation.`;

export const EXTRACT_LAUNCH_USER_PROMPT = (article: RSSEntry) => `Analyze this article and if it mentions one or more launches, extract these pieces of data for each launch, if they are present:

Sometimes there will be a primary launch with a lot of details, and other launches that are mentioned or referenced without a lot of details. If references launches don't have sufficient detail to provide a full, high-confidence launch data object, ignore them. Only include launches that have sufficient detail to provide a full launch data object.

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
- links: A list of links to other RELEVANT pages or articles, not images or other media, with urls about the launch from the article (e.g. the launch page, or any other relevant pages). Only include links directly related to this launch, not reference or general information. These should be in the format [{title:string,type:string[],url:string}].
- videos: A list of links with urls to videos related to the launch. Look for youtube embeds, etc. These should be in the format [{title:string,type:string[],source:string,url:string,video_id?:string}]. If the video is from youtube (or another well known service), please return the "watch" url, not the embed url, and include the video_id. 

A few extra details about launch_datetime:
- If there is a day and time but no year, assume the current year: ${new Date().getUTCFullYear()}, as long as it seems correct for the launch.
- If the article says something vague like "Tuesday night" but includes a publication date, prefer using that date to resolve the weekday.
- Do not infer the launch date from image filenames unless explicitly stated in the text.
- Ignore any filename-derived dates unless directly referenced in the article body.

Return the data as a json object with the keys as the above names. If there are multiple launches, return an array of objects.
If there are no launches, return an empty array. Remember, it is ok to ignore launches that are mentioned but don't have sufficient detail in the article.

Here is the article:

Title: ${article.title}

Publication Date: ${article.pubDate}

Content: ${article.content}`;

