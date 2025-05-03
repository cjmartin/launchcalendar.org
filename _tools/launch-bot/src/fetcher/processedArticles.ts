import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { RSSEntry } from '../types';
import { fetchRSSFeed } from './rssFetcher';

// New type for processed article
export interface ProcessedArticle {
  link: string;
  hash: string;
}

const PROCESSED_ARTICLES_PATH = path.resolve(__dirname, '../../data/processed-articles.json');

export async function getProcessedArticles(): Promise<Map<string, string>> {
  try {
    const data = await fs.readFile(PROCESSED_ARTICLES_PATH, 'utf8');
    const arr: ProcessedArticle[] = JSON.parse(data);
    return new Map(arr.map(item => [item.link, item.hash]));
  } catch (e) {
    return new Map();
  }
}

export async function addProcessedArticles(articles: ProcessedArticle[]): Promise<void> {
  const processed = await getProcessedArticles();
  articles.forEach(({ link, hash }) => processed.set(link, hash));
  const arr: ProcessedArticle[] = Array.from(processed.entries()).map(([link, hash]) => ({ link, hash }));
  await fs.writeFile(PROCESSED_ARTICLES_PATH, JSON.stringify(arr, null, 2), 'utf8');
}

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Loads feeds, fetches all entries, and returns an array of { entry, hash } for new or updated articles.
 * Compares the hash of each entry's content to the stored hash.
 * Updates PLACEHOLDER hashes in processed-articles.json but does not treat them as new/updated articles.
 */
export async function getNewOrUpdatedArticles(): Promise<{ article: RSSEntry; hash: string }[]> {
  // Load feeds.json
  const feedsPath = path.resolve(__dirname, '../../data/feeds.json');
  const feeds: string[] = JSON.parse(await fs.readFile(feedsPath, 'utf8'));
  const allEntries: RSSEntry[] = [];
  for (const feedUrl of feeds) {
    try {
      const entries = await fetchRSSFeed(feedUrl);
      allEntries.push(...entries);
    } catch (e) {
      console.error(`Failed to fetch feed: ${feedUrl}`, e);
    }
  }
  // Load processed articles as array for possible update
  const processedPath = PROCESSED_ARTICLES_PATH;
  const processedArr: ProcessedArticle[] = JSON.parse(await fs.readFile(processedPath, 'utf8'));
  const processedMap = new Map(processedArr.map(a => [a.link, a]));
  const result: { article: RSSEntry; hash: string }[] = [];
  let updated = false;
  for (const entry of allEntries) {
    const contentHash = hashContent(entry.content || "");
    const processed = processedMap.get(entry.link);
    if (processed) {
      if (processed.hash === "PLACEHOLDER") {
        processed.hash = contentHash;
        updated = true;
        // Do NOT consider this an update for result
        continue;
      }
      if (processed.hash !== contentHash) {
        result.push({ article: entry, hash: contentHash });
      }
    } else {
      result.push({ article: entry, hash: contentHash });
    }
  }
  if (updated) {
    await fs.writeFile(processedPath, JSON.stringify(Array.from(processedMap.values()), null, 2), 'utf8');
    console.log('✅ Updated PLACEHOLDER hashes in processed-articles.json');
  }
  return result;
}