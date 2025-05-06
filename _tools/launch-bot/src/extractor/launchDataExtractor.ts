import { LaunchData, LaunchLink, RSSEntry } from '../types';
import { callOpenAI } from '../utils/openai';
import { EXTRACT_LAUNCH_SYSTEM_PROMPT, EXTRACT_LAUNCH_USER_PROMPT } from '../prompts';

export async function extractLaunchData(entry: RSSEntry): Promise<LaunchData[]> {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  messages.push({ role: 'system', content: EXTRACT_LAUNCH_SYSTEM_PROMPT });
  messages.push({
    role: 'user',
    content: EXTRACT_LAUNCH_USER_PROMPT(entry),
  });

  const response = await callOpenAI(messages);
  try {
    // Try to parse the response as JSON
    const parsed = JSON.parse(response);
    
    // Ensure parsed is always an array
    const launches: LaunchData[] = Array.isArray(parsed) ? parsed : [parsed];

    // Post processing
    launches.forEach(launch => {
      // Add or update the article link in 'links' for each launch
      if (!launch.links) launch.links = [];
      const existingIdx = launch.links.findIndex((l) => l.url === entry.link);    
      if (existingIdx !== -1) {
        // Merge and deduplicate types
        const currentTypes = launch.links[existingIdx].type || [];
        launch.links[existingIdx].type = Array.from(new Set([...currentTypes, "article", "source"]));
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