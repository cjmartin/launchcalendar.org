// agent.ts

import { detectLaunch } from "./analyzer/launchDetector";
import { extractLaunchData } from "./extractor/launchDataExtractor";
import { fetchRSSFeed } from "./fetcher/rssFetcher";
import { findExistingLaunch } from "./matcher/launchFileMatcher";
import { updateOrCreateLaunchFile } from "./updater/launchFileUpdater";
import {
  getProcessedArticles,
  addProcessedArticles,
} from "./fetcher/processedArticles";
import fs from "fs/promises";
import { RSSEntry } from "./types";
import { normalizeLaunchData } from "./normalizer/normalizeLaunchData";
import path from "path";
import { filenameFromLaunchData } from "./updater/launchFileUpdater";
import {
  checkoutOrCreateBranch,
  commitLaunchChanges,
  pushAllLaunchBranches,
  openPullRequestsForLaunchBranches,
  commitAndPushGlobalChanges,
} from "./utils/git";

async function getAllFeedEntries(): Promise<RSSEntry[]> {
  const feedsPath = require("path").resolve(__dirname, "../data/feeds.json");
  const feeds: string[] = JSON.parse(await fs.readFile(feedsPath, "utf8"));
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

  // Fetch recent posts from all feeds
  const entries = await getAllFeedEntries();

  // Load processed articles
  const processed = await getProcessedArticles();

  // Filter out already-processed articles
  const newEntries = entries.filter((entry) => !processed.has(entry.link));

  // limit entries to 5 for testing
  const limitedEntries = newEntries.slice(0, 5);
  console.log(`📥 Fetched ${limitedEntries.length} new entries from RSS feed.`);

  const processedLinks: string[] = [];

  for (const entry of limitedEntries) {
    console.log(`🔍 Checking entry: ${entry.title}`);
    console.log(`🔗 Link: ${entry.link}`);
    // console.log(`📝 Content: ${entry.content`);

    // Analyze whether it's a launch
    const isLaunch = await detectLaunch(entry);
    if (!isLaunch) {
      console.log(`❌ Not a launch: ${entry.title}`);

      // Mark this article as processed
      processedLinks.push(entry.link);
      continue;
    }

    console.log(`✅ Launch data likely present`);

    // Extract launch data
    const launchData = await extractLaunchData(entry);

    if (!launchData || !launchData.length) {
      console.log(`❌ Failed to extract launch data: ${entry.title}`);

      // Mark this article as processed
      processedLinks.push(entry.link);
      continue;
    }
    console.log(`🎉 Launch data extracted`);

    for (const launch of launchData) {
      // Normalize launch data
      const normalizedLaunch = await normalizeLaunchData(launch);

      // Find existing file
      const matchResult = await findExistingLaunch(normalizedLaunch);
      let branchBaseName: string;
      if (matchResult.existingPath) {
        branchBaseName = path.basename(matchResult.existingPath, ".md");
      } else {
        const newFilename = filenameFromLaunchData(normalizedLaunch);
        branchBaseName = newFilename.replace(/\.md$/, "");
      }
      const branchName = `launch/${branchBaseName}`;
      console.log(`🌿 [GIT] Preparing branch: ${branchName}`);
      await checkoutOrCreateBranch(branchName);

      if (matchResult.existingPath) {
        console.log(
          `🔍 Existing launch file found: ${matchResult.existingPath}`
        );
      } else {
        console.log(`🆕 No existing file found, will create a new one.`);
      }
      await updateOrCreateLaunchFile(matchResult, normalizedLaunch);
      console.log(
        `📝 Launch file updated or created: ${
          matchResult.existingPath || "New file created"
        }`
      );

      await commitLaunchChanges(branchName, normalizedLaunch);
    }

    // Mark this article as processed
    processedLinks.push(entry.link);
  }

  // --- GIT WORKFLOW: After all launches ---
  await pushAllLaunchBranches();
  await openPullRequestsForLaunchBranches();

  // Add processed links to the record
  await addProcessedArticles(processedLinks);
  
  await commitAndPushGlobalChanges();
  console.log("🏁 Agent run complete.");
}

main().catch((err) => {
  console.error("💥 Agent crashed:", err);
});
