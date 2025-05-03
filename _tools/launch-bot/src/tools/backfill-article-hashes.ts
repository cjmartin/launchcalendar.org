import { getProcessedArticles, hashContent, ProcessedArticle } from '../fetcher/processedArticles';
import { fetchAllFeedsEntries } from '../fetcher/rssFetcher';
import fs from 'fs/promises';
import path from 'path';

async function backfillArticleHashes() {
  const processedPath = path.resolve(__dirname, '../../data/processed-articles.json');
  const allEntries = await fetchAllFeedsEntries();
  const allContent = new Map(allEntries.map(e => [e.link, e.content || '']));
  const processedArr: ProcessedArticle[] = JSON.parse(await fs.readFile(processedPath, 'utf8'));
  let updated = false;
  for (const article of processedArr) {
    if (allContent.has(article.link)) {
      const hash = hashContent(allContent.get(article.link)!);
      if (article.hash !== hash) {
        article.hash = hash;
        updated = true;
      }
    }
  }
  if (updated) {
    await fs.writeFile(processedPath, JSON.stringify(processedArr, null, 2), 'utf8');
    console.log('✅ Backfilled hashes for processed articles.');
  } else {
    console.log('ℹ️ No hashes needed updating.');
  }
}

backfillArticleHashes();
