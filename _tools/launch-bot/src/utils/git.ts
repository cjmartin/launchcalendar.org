// git.ts
// Stubs for git and GitHub workflow integration using simple-git and octokit

import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import path from 'path';
import { Octokit } from '@octokit/rest';

// Find the repo root (parent of _tools)
const repoRoot = path.resolve(__dirname, '../../../../');
const git: SimpleGit = simpleGit(repoRoot);

// Initialize octokit lazily to handle ESM import
// Not needed with downgraded octokit version, but keeping
// the loader fuction in case I try and upgrade again later.
let _octokit: Octokit | null = null;
function getOctokit() {
  if (!_octokit) {
    _octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return _octokit;
}

// Track which branches had changes committed
const committedBranches = new Set<string>();

export function getCommittedBranches(): string[] {
  return Array.from(committedBranches);
}

export function resetCommittedBranches() {
  committedBranches.clear();
}

// Track which branches were pushed
const pushedBranches = new Set<string>();

export function getPushedBranches(): string[] {
  return Array.from(pushedBranches);
}

export function resetPushedBranches() {
  pushedBranches.clear();
}

/**
 * Checks out the main branch and pulls the latest changes.
 */
export async function checkoutMainBranch() {
  const isBehind = (status: StatusResult) => status.behind && status.behind > 0;

  try {
    const status = await git.status();
    const currentBranch = status.current;

    // Check if already on main
    if (currentBranch === 'main') {
      // Only pull if local main is behind origin/main
      if (isBehind(status)) {
        await git.pull('origin', 'main');
        console.log('[GIT] ✓ Pulled latest changes for main branch.');
      } else {
        console.log('[GIT] Already on main and up to date with origin/main.');
      }
      return;
    }

    await git.checkout('main');
    // After checkout, check if main is behind
    const postCheckoutStatus = await git.status();
    if (isBehind(postCheckoutStatus)) {
      await git.pull('origin', 'main');
      console.log('[GIT] ✓ Checked out and pulled latest changes for main branch.');
    } else {
      console.log('[GIT] Checked out main and it is up to date with origin/main.');
    }
    
  } catch (error) {
    console.error('[GIT] ✗ Failed to checkout/pull main branch:', error);
    throw error;
  }
}

/**
 * Checks out the given branch, creating it from main if it doesn't exist.
 */
export async function checkoutOrCreateBranch(branchName: string) {
  try {
    // Fetch all remotes to ensure we see remote branches
    await git.fetch();

    // Checkout main and pull latest changes before switching branches
    await checkoutMainBranch();
    
    // Check if the branch already exists locally
    const branches = await git.branchLocal();
    if (branches.all.includes(branchName)) {
      console.log(`[GIT] Branch already exists, checking out: ${branchName}`);
      await git.checkout(branchName);
      try {
        await git.pull('origin', 'main');
        console.log(`[GIT] ✓ Pulled latest main into branch: ${branchName}`);
      } catch (mergeErr) {
        console.log(`[GIT] Could not pull main into branch: ${branchName}`);
      }
      try {
        await git.pull('origin', branchName, ['--rebase']);
        console.log(`[GIT] ✓ Checked out and updated existing branch from its remote: ${branchName}`);
      } catch (pullErr) {
        console.log(`[GIT] Checked out existing branch but could not pull remote (may not exist yet): ${branchName}`);
      }
      return;
    }

    // Check if the branch exists on the remote
    const remoteBranches = await git.branch(['-r']);
    const remoteBranchName = `origin/${branchName}`;
    if (remoteBranches.all.includes(remoteBranchName)) {
      console.log(`[GIT] Remote branch exists, checking out tracking branch: ${branchName}`);
      await git.checkout(['-b', branchName, '--track', remoteBranchName]);
      try {
        await git.pull('origin', 'main');
        console.log(`[GIT] ✓ Pulled latest main into branch: ${branchName}`);
      } catch (mergeErr) {
        console.log(`[GIT] Could not pull main into branch: ${branchName}`);
      }
      try {
        await git.pull('origin', branchName, ['--rebase']);
        console.log(`[GIT] ✓ Checked out and updated tracking branch from remote: ${branchName}`);
      } catch (pullErr) {
        console.log(`[GIT] Checked out tracking branch but could not pull remote: ${branchName}`);
      }
      return;
    }

    // Branch does not exist, create it from main
    console.log(`[GIT] Branch does not exist, creating: ${branchName}`);

    // Create and checkout the new branch
    await git.checkoutLocalBranch(branchName);
    console.log(`[GIT] ✓ Created and checked out new branch: ${branchName}`);
  } catch (error) {
    console.error(`[GIT] ✗ Failed to checkout/create branch ${branchName}:`, error);
    throw error;
  }
}

/**
 * Commits all changes related to a launch in the current branch.
 */
export async function commitLaunchChanges(branchName: string, launchData: any): Promise<boolean> {
  try {
    // Stage all changes (or specify file(s) if you want to be more specific)
    await git.add('.');
    // Prepare a commit message
    const date = launchData.launch_datetime ? ` (${launchData.launch_datetime})` : '';
    const vehicle = launchData.vehicle ? ` ${launchData.vehicle}` : '';
    const payload = launchData.payload ? ` - ${launchData.payload}` : '';
    const message = `Update launch:${vehicle}${payload}${date}`.trim();
    // Only commit if there are staged changes
    const status = await git.status();
    if (status.staged.length > 0) {
      await git.commit(message);
      committedBranches.add(branchName);
      console.log(`[GIT] ✓ Committed changes for branch: ${branchName}`);
      return true;
    } else {
      console.log(`[GIT] No changes to commit for branch: ${branchName}`);
      return false;
    }
  } catch (error) {
    console.error(`[GIT] ✗ Failed to commit changes for branch ${branchName}:`, error);
    throw error;
  }
}

/**
 * Pushes all launch branches to the remote repository.
 */
export async function pushAllLaunchBranches() {
  try {
    const branches = getCommittedBranches();
    for (const branch of branches) {
      await git.checkout(branch);
      // Push local branch to remote
      await git.push('origin', branch);
      pushedBranches.add(branch);
      console.log(`[GIT] ✓ Pushed branch: ${branch}`);
    }
    // Switch back to main branch after pushing
    await checkoutMainBranch();
  } catch (error) {
    console.error('[GIT] ✗ Failed to push launch branches:', error);
    // Ensure we return to the main branch even if pushing fails
    await checkoutMainBranch();
    throw error;
  }
}

/**
 * Opens pull requests for each launch branch into main.
 */
export async function openPullRequestsForLaunchBranches() {
  const branches = getPushedBranches();
  if (!process.env.GITHUB_TOKEN) {
    console.error('[GITHUB] GITHUB_TOKEN not set in environment. Skipping PR creation.');
    return;
  }
  const octokit = getOctokit();

  // Use environment variables or fallback to hardcoded values
  const owner = process.env.GITHUB_OWNER || 'cjmartin';
  const repo = process.env.GITHUB_REPO || 'launchcalendar.org';

  for (const branch of branches) {
    // Check if a PR already exists from this branch to main
    const prs = await (await octokit).pulls.list({ owner, repo, head: `${owner}:${branch}`, base: 'main', state: 'open' });
    if (prs.data.length > 0) {
      console.log(`[GITHUB] PR already exists for branch: ${branch}`);
      continue;
    }
    // Create a new PR
    const title = `Update for launch: ${branch.replace('launch/', '')}`;
    const body = 'Automated update for launch data.';
    try {
      const pr = await (await octokit).pulls.create({
        owner,
        repo,
        head: branch,
        base: 'main',
        title,
        body,
      });
      console.log(`[GITHUB] Opened PR #${pr.data.number} for branch: ${branch}`);
    } catch (err) {
      console.error(`[GITHUB] Failed to open PR for branch: ${branch}`, err);
    }
  }
  resetPushedBranches();
}

/**
 * Commits and pushes global file changes (like processed-articles.json) to main.
 */
export async function commitAndPushGlobalChanges() {
  try {
    // Ensure we're on the main branch.
    // This shouldn't be called if we're on a launch branch, but just in case.
    // Better to have an issue switching back to main than to push a launch branch to main.
    await checkoutMainBranch();
    await git.add('.');
    const status = await git.status();
    if (status.staged.length > 0) {
      const message = `Update global files (${new Date().toISOString()})`;
      await git.commit(message);
      await git.push('origin', 'main');
      console.log('[GIT] ✓ Committed and pushed global changes to main.');
    } else {
      console.log('[GIT] No global changes to commit.');
    }
  } catch (error) {
    console.error('[GIT] ✗ Failed to commit/push global changes:', error);
    throw error;
  }
}
