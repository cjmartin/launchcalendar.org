import Parser from 'rss-parser';
// import TurndownService from 'turndown';
import { RSSEntry } from '../types';

const parser = new Parser();
// const turndown = new TurndownService();

export async function fetchRSSFeed(feedUrl: string): Promise<RSSEntry[]> {
  const feed = await parser.parseURL(feedUrl);

  return feed.items.map(item => {
    const htmlContent = item['content:encoded'] || item.content || '';
    // const markdownContent = htmlContent ? turndown.turndown(htmlContent) : '';
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