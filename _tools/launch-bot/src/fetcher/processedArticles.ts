import fs from 'fs/promises';
import path from 'path';

// Processed articles are currently stored in a JSON file.
// It might make sense to use a database in the future, but for now, this works.
const PROCESSED_ARTICLES_PATH = path.resolve(__dirname, '../../data/processed-articles.json');

export async function getProcessedArticles(): Promise<Set<string>> {
  try {
    const data = await fs.readFile(PROCESSED_ARTICLES_PATH, 'utf8');
    return new Set(JSON.parse(data));
  } catch (e) {
    return new Set();
  }
}

export async function addProcessedArticles(links: string[]): Promise<void> {
  const processed = await getProcessedArticles();
  links.forEach(link => processed.add(link));
  await fs.writeFile(PROCESSED_ARTICLES_PATH, JSON.stringify(Array.from(processed), null, 2), 'utf8');
}