// check-missing-location-slugs.ts
// Script to find launch files missing location_slug, match their site, and write results to JSON

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { loadSiteTable, matchSite } from '../matcher/launchSiteMatcher';
import { fileDataToLaunchData } from '../updater/launchFileUpdater';

async function getAllLaunchFiles() {
  const postsDir = path.resolve(__dirname, '../../../../_posts');
  const draftsDir = path.resolve(__dirname, '../../../../_drafts');
  let files: string[] = [];
  try {
    const postFiles = (await fs.readdir(postsDir)).filter(f => f.endsWith('.md')).map(f => path.join(postsDir, f));
    let draftFiles: string[] = [];
    try {
      draftFiles = (await fs.readdir(draftsDir)).filter(f => f.endsWith('.md')).map(f => path.join(draftsDir, f));
    } catch {}
    files = [...postFiles, ...draftFiles];
  } catch (e) {
    console.error('Error reading launch files:', e);
  }
  return files;
}

async function checkMissingLaunchSlugs() {
  const files = await getAllLaunchFiles();
  const siteTable = await loadSiteTable();
  const results = [];

  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = matter(content);
      const launchData = fileDataToLaunchData(parsed);
      if (launchData.location && !launchData.location_slug) {
        const match = matchSite(launchData, siteTable);
        results.push({ file: filePath, launchData, match });
      }
    } catch (e) {
      console.error(`Failed to process ${filePath}:`, e);
    }
  }

  const outPath = path.resolve(__dirname, './missing-location-slugs.json');
  console.log(`Writing results to ${outPath}`);
  await fs.writeFile(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Results written to ${outPath}`);
}

if (require.main === module) {
  checkMissingLaunchSlugs();
}