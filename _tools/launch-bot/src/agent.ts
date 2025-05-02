// agent.ts

import { detectLaunch } from './analyzer/launchDetector';
import { extractLaunchData } from './extractor/launchDataExtractor';
import { fetchRSSFeed } from './fetcher/rssFetcher';
import { findExistingLaunch } from './matcher/launchFileMatcher';
import { updateOrCreateLaunchFile, filenameFromLaunchData } from './updater/launchFileUpdater';
import { getProcessedArticles, addProcessedArticles } from './fetcher/processedArticles';
import { Git } from './utils/git';
import fs from 'fs/promises';
import path from 'path';
import { RSSEntry } from './types';
import { normalizeLaunchData } from './normalizer/normalizeLaunchData';
import dotenv from 'dotenv';

dotenv.config();

async function getAllFeedEntries(): Promise<RSSEntry[]> {
  const feedsPath = require('path').resolve(__dirname, '../data/feeds.json');
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

async function main() {
  console.log("🚀 LaunchCalendar Agent starting...");

  // Initialize Git workflow
  const repoPath = path.resolve(__dirname, '../../..');
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN environment variable not set');
  }
  const git = new Git(repoPath, githubToken);

  // Fetch recent posts from all feeds
  const entries = await getAllFeedEntries();

  // Load processed articles
  const processed = await getProcessedArticles();

  // Filter out already-processed articles
  const newEntries = entries.filter(entry => !processed.has(entry.link));

  // limit entries to 5 for testing
  const limitedEntries = newEntries.slice(0, 5);
  console.log(`📥 Fetched ${limitedEntries.length} new entries from RSS feed.`);

  const processedLinks: string[] = [];
  const updatedBranches = new Set<string>();

  for (const entry of limitedEntries) {
    console.log(`🔍 Checking entry: ${entry.title}`);
    console.log(`🔗 Link: ${entry.link}`);
    // console.log(`📝 Content: ${entry.content}`);

    // Analyze whether it's a launch
    const isLaunch = await detectLaunch(entry);
    if (!isLaunch) {
      console.log(`❌ Not a launch: ${entry.title}`);
      processedLinks.push(entry.link);
      continue;
    }

    console.log(`✅ Launch data likely present`);

    // Extract launch data
    const launchData = await extractLaunchData(entry);

    if (!launchData || !launchData.length) {
      console.log(`❌ Failed to extract launch data: ${entry.title}`);
      processedLinks.push(entry.link);
      continue;
    }
    console.log(`🎉 Launch data extracted`);

    for (const launch of launchData) {
      // Normalize launch data
      const normalizedLaunch = await normalizeLaunchData(launch);
      
      // Find existing file
      const matchResult = await findExistingLaunch(normalizedLaunch);
      
      // Create or switch to appropriate branch
      const filename = matchResult.existingPath ? 
        path.basename(matchResult.existingPath) :
        filenameFromLaunchData(normalizedLaunch);
      
      const branchName = await git.ensureLaunchBranch(filename);
      console.log(`🌿 Using branch: ${branchName}`);

      if (matchResult.existingPath) {
        console.log(`🔍 Existing launch file found: ${matchResult.existingPath}`);
      } else {
        console.log(`🆕 No existing file found, will create a new one.`);
      }

      // Update or create launch post
      await updateOrCreateLaunchFile(matchResult, normalizedLaunch);
      console.log(`📝 Launch file updated or created: ${matchResult.existingPath || 'New file created'}`);

      // Commit changes
      await git.commitChanges(`Update launch data for ${normalizedLaunch.vehicle} | ${normalizedLaunch.payload}`);
      updatedBranches.add(branchName);
    }

    // Mark this article as processed
    processedLinks.push(entry.link);
  }

  // Push all branches and create PRs
  for (const branch of updatedBranches) {
    await git.pushCurrentBranch();
    await git.createPullRequest(
      `Launch update: ${branch.replace('launch/', '')}`,
      'Automated launch data update by launch-bot'
    );
  }

  // Switch back to main for processed-articles.json update
  await git.checkout('main');
  
  // Add processed links to the record
  await addProcessedArticles(processedLinks);
  
  // Commit and push processed-articles.json update
  await git.commitChanges('Update processed articles list');
  await git.pushCurrentBranch();

  console.log("🏁 Agent run complete.");
}

main().catch((err) => {
  console.error("💥 Agent crashed:", err);
});