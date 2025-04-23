import { LaunchData, LaunchLink, RSSEntry } from '../types';
import { callOpenAI } from '../utils/openai';

export async function extractLaunchData(entry: RSSEntry): Promise<LaunchData[]> {
  const messages:{ role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  messages.push({role: 'system', content: 'You are a launch data extractor. Your job is to extract launch data from articles. You will be given an article and you need to analyze it for any mentions of rocket launches. If you find any, extract the relevant data as specified below, paying close attention to the description of each piece of data. Important: Respond only with valid JSON. Do not include any extra text or explanation.'});
  messages.push({role: 'user', content: `Analyze this article and if it mentions one or more launches, extract these pieces of data for each launch, if they are present:

- launch_datetime: The date and time of the scheduled launch in ISO8601 UTC format. This is a very important field and needs to be correct. If there is a day and time but no year, consider the publish date or assume the current year.
- location: What is the launch site? (e.g. SLC-40, Cape Canaveral Air Force Station, Florida)
- manned: Is this a manned mission? (true/false)
- vehicle: What is the launch vehicle? (e.g. Falcon 9, Atlas V, etc.)
- vehicle_type: Most likely 'rocket'
- payload: What is being sent to orbit? This will be the name of the payload or mission. (e.g. Bandwagon-3, CRS-32 Cargo Dragon, NROL-145, NROL-174, Starlink 6-73, etc.) If a name is not determined, use "unknown" as the value.
- payload_type: What type of object is being sent to orbit? (e.g. satellite, cargo module, crew capsule, classified, etc.) If the payload is classified, use "classified" as the value.
- description: A very short description of the launch
- tags: A list of tags for this launch. These should be relevant to the launch and could include things like the vehicle name, payload name, etc.
- article_summary: A summary of the launch details, updates, interesting information, etc. from this article, to be used as the body of the launch file. This shoud be plain text or markdown, if there are relevant links in the article. This should be a summary of the article, not a copy of the article.
- links: A list of links to other RELEVANT pages or articles, not images or other media, with urls about the launch from the article (e.g. the launch page, or any other relevant pages). These should be in the format [{title:string,type:string[],url:string}].
- videos: A list of links with urls to videos related to the launch. Look for youtube embeds, etc. These should be in the format [{title:string,type:string,url:string}].

Return the data as a json object with the keys as the above names. If there are multiple launches, return an array of objects.
If there are no launches, return an empty array.

Here is the article:

Publish Date: ${entry.pubDate}

Title: ${entry.title}

Content: ${entry.content}`});

  const response = await callOpenAI(messages);
  try {
    // Try to parse the response as JSON
    const parsed = JSON.parse(response);
    // Ensure parsed is always an array
    const launches: LaunchData[] = Array.isArray(parsed) ? parsed : [parsed];
    // Add or update the article link in 'links' for each launch
    launches.forEach(launch => {
      if (!launch.links) launch.links = [];
      const existingIdx = launch.links.findIndex((l) => l.url === entry.link);
      if (existingIdx !== -1) {
        // Update the title if the link exists
        launch.links[existingIdx].title = entry.title;
        launch.links[existingIdx].type = [...launch.links[existingIdx].type, ...["article", "source"]];
      } else {
        // Add the article link
        launch.links.push({ title: entry.title, type: ["article", "source"], url: entry.link });
      }
    });
    return launches;
  }
  catch (error) {
    // If parsing fails, log the error and return an empty array
    console.error('Failed to parse JSON response:', error);
    console.error('Response:', response);
    // Return an empty array to indicate no launches found
    return [];
  }
}