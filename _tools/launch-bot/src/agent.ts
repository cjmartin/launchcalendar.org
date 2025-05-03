// agent.ts

import { detectLaunch } from "./analyzer/launchDetector";
import { extractLaunchData } from "./extractor/launchDataExtractor";
import { findExistingLaunch } from "./matcher/launchFileMatcher";
import { updateOrCreateLaunchFile } from "./updater/launchFileUpdater";
import {
  addProcessedArticles,
  getNewOrUpdatedArticles,
  ProcessedArticle,
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
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log("🚀 LaunchCalendar Agent starting...");
  await checkoutOrCreateBranch('main');

  // Use consolidated logic to get new or updated articles (fetches feeds internally)
  const newOrUpdatedArticles = await getNewOrUpdatedArticles();

  // limit articles to 5 for testing
  const limitedArticles = newOrUpdatedArticles.slice(0, 5);
  console.log(`📥 Fetched ${limitedArticles.length} new or updated articles from RSS feed.`);

  const processedArticles: ProcessedArticle[] = [];

  for (const { article, hash } of limitedArticles) {
    console.log(`🔍 Checking article: ${article.title}`);
    console.log(`🔗 Link: ${article.link}`);
    // Analyze whether it's a launch
    const isLaunch = await detectLaunch(article);
    if (!isLaunch) {
      console.log(`❌ Not a launch: ${article.title}`);
      processedArticles.push({ link: article.link, hash });
      continue;
    }

    console.log(`✅ Launch data likely present in article: ${article.title}`);

    // Extract launch data
    const launchData = await extractLaunchData(article);

    if (!launchData || !launchData.length) {
      console.log(`❌ Failed to extract launch data: ${article.title}`);
      processedArticles.push({ link: article.link, hash });
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

    processedArticles.push({ link: article.link, hash });
  }

  // --- GIT WORKFLOW: After all launches ---
  await pushAllLaunchBranches();
  await openPullRequestsForLaunchBranches();

  // Add processed articles (with hashes) to the record
  await addProcessedArticles(processedArticles);
  
  await commitAndPushGlobalChanges();
  console.log("🏁 Agent run complete.");
}

main().catch((err) => {
  console.error("💥 Agent crashed:", err);
});
