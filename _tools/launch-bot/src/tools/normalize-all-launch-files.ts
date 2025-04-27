// normalize-all-launch-files.ts
// Script to normalize all launch files in _posts and _drafts using normalizeLaunchData

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { fileDataToLaunchData, createLaunchFile } from '../updater/launchFileUpdater';
import { normalizeLaunchData } from '../normalizer/normalizeLaunchData';

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

async function normalizeAllLaunchFiles() {
  const files = await getAllLaunchFiles();
  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = matter(content);
      const launchData = fileDataToLaunchData(parsed);
      const normalized = await normalizeLaunchData(launchData);
      
      // Only update if normalization changed something
      if (JSON.stringify(launchData) !== JSON.stringify(normalized)) {
        console.log(`Normalizing: ${filePath}`);
        const newContent = createLaunchFile(filePath, normalized);
        await fs.writeFile(filePath, newContent, 'utf8');
        console.log(`✅ Normalized: ${filePath}`);
      } else {
        console.log(`➖ No change: ${filePath}`);
      }
    } catch (e) {
      console.error(`❌ Failed to normalize ${filePath}:`, e);
    }
  }
}

if (require.main === module) {
  normalizeAllLaunchFiles().then(() => {
    console.log('🏁 Normalization complete.');
  });
}
