import dotenv from 'dotenv';
dotenv.config();

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

  // Simulate a file change and commit (optional, for a real test)
  await commitLaunchChanges(testBranch, { vehicle: 'Test', payload: 'Test', launch_datetime: '2025-05-03' });

  // Simulate pushing the branch (if not already pushed)
  await pushAllLaunchBranches();

  // Now test PR creation
  await openPullRequestsForLaunchBranches();
}

main().catch(console.error);
