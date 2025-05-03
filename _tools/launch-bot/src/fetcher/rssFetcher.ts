import Parser from 'rss-parser';
import fs from 'fs/promises';
import path from 'path';
import { RSSEntry } from '../types';

const parser = new Parser(
  {
    customFields: {
      item: [
        ['content:encoded', 'content:encoded'],
        ['dc:content', 'dc:content'],
        ['description', 'description'],
      ]
    }
  }
);

export async function fetchRSSFeed(feedUrl: string): Promise<RSSEntry[]> {
  const feed = await parser.parseURL(feedUrl);

  return feed.items.map(item => {
    const htmlContent = item['content:encoded'] || item['dc:content'] || item.content || '';
    return {
      title: item.title || '',
      link: item.link || '',
      contentSnippet: item.contentSnippet || '',
      description: item.description || '',
      content: htmlContent,
      pubDate: item.pubDate || ''
    };
  });
}

/**
 * Fetches all entries from all feeds listed in feeds.json.
 */
export async function fetchAllFeedsEntries(): Promise<RSSEntry[]> {
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
  return allEntries;
}