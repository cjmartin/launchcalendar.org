import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';

import {
  openPullRequestsForLaunchBranches,
  pushAllLaunchBranches,
  commitLaunchChanges,
  checkoutOrCreateBranch,
} from '../utils/git';

async function main() {
  // Example: use an existing launch branch or create a test branch
  const testBranch = 'launch/test-pr-branch';
  await checkoutOrCreateBranch(testBranch);

  // Actually make a file change so there is something to commit
  const testFilePath = path.resolve(__dirname, '../../../../_drafts/test-git-pr.md');
  const testContent = `---\ntitle: Test PR\ndate: ${new Date().toISOString()}\n---\n\nThis is a test file for PR automation.\n`;
  await fs.writeFile(testFilePath, testContent, 'utf8');

  // Commit the change
  await commitLaunchChanges(testBranch, { vehicle: 'Test', payload: 'Test', launch_datetime: new Date().toISOString() });

  // Push the branch
  await pushAllLaunchBranches();

  // Now test PR creation
  await openPullRequestsForLaunchBranches();
}

main().catch(console.error);
