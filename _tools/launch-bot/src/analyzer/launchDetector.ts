import { RSSEntry } from "../types";
import { callOpenAI } from "../utils/openai";
import { DETECT_LAUNCH_PROMPT } from "../prompts";

export async function detectLaunch(entry: RSSEntry) {
  const prompt = DETECT_LAUNCH_PROMPT(entry);
  const result = await callOpenAI([{role: 'user', content: prompt}]);
  return result.trim().toLowerCase() === 'yes';
}