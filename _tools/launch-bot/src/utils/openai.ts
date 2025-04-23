import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

// Change these to run against different (OpenAI compatible) APIs/midels, like ollama.
let baseURL = 'https://api.openai.com/v1/'; // 'http://127.0.0.1:11434/v1' 'https://api.openai.com/v1/'
let model = 'gpt-4.1'; // 'gpt-4' 'llama3.2:latest' 'deepseek-r1:8b' 'mistral-small:latest'

export async function callOpenAI(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], GPTmodel?: { baseUrl: string, model: string }): Promise<string> {
  if (GPTmodel) {
    baseURL = GPTmodel.baseUrl;
    model = GPTmodel.model;
  }
  
  const isOpenAI = baseURL.startsWith('https://api.openai.com');

  const apiKey = isOpenAI ? process.env.OPENAI_API_KEY : 'ollama';
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set.');
  }

  const openai = new OpenAI({
    apiKey,
    baseURL,
  });

  try {
    const completion = await openai.chat.completions.create({
      model, // Ensure the correct model name
      messages,
    });
    return completion.choices[0].message?.content || '';
  } catch (error: any) {
    console.error('OpenAI API error:', error.message || error);
    throw error;
  }
}