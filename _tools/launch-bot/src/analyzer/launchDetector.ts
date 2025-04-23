import { RSSEntry } from "../types";
import { callOpenAI } from "../utils/openai";

export async function detectLaunch(entry: RSSEntry) {
  const prompt = `Based on the title and description of this article, could the article include information about a rocket launch (flight, mission, etc.)? Reply "yes" or "no".\n\nTitle: ${entry.title}\n\nDescription: ${entry.description}\n\nContent Snippet: ${entry.contentSnippet}`;
  const result = await callOpenAI([{role: 'user', content: prompt}]);
  return result.trim().toLowerCase() === 'yes';
}