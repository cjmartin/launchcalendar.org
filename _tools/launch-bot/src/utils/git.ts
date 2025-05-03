// git.ts
// Stubs for git and GitHub workflow integration using simple-git and octokit

import simpleGit, { SimpleGit } from 'simple-git';
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
 * Checks out the given branch, creating it from main if it doesn't exist.
 */
export async function checkoutOrCreateBranch(branchName: string) {
  try {
    // Check if the branch already exists
    const branches = await git.branchLocal();
    
    if (branches.all.includes(branchName)) {
      console.log(`[GIT] Branch already exists, checking out: ${branchName}`);
      // Checkout the existing branch
      await git.checkout(branchName);
      // Pull latest changes from remote for this branch
      try {
        await git.pull('origin', branchName);
        console.log(`[GIT] ✓ Checked out and updated existing branch from its remote: ${branchName}`);
      } catch (pullErr) {
        console.log(`[GIT] Checked out existing branch but could not pull remote (may not exist yet): ${branchName}`);
      }
      // Also pull latest main into this branch
      try {
        await git.pull('origin', 'main', ['--rebase']);
        console.log(`[GIT] ✓ Pulled latest main into branch: ${branchName}`);
      } catch (mergeErr) {
        console.log(`[GIT] Could not pull main into branch: ${branchName}`);
      }
      return;
    }

    // Branch does not exist, create it from main
    console.log(`[GIT] Branch does not exist, creating: ${branchName}`);

    // Checkout main and pull latest changes
    await git.checkout('main');
    await git.pull('origin', 'main');

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
    // Do not reset committedBranches here; let PR step use it if needed
  } catch (error) {
    console.error('[GIT] ✗ Failed to push launch branches:', error);
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
  const octokit = await getOctokit();
  // Get repo info from git remote
  const remotes = await git.getRemotes(true);
  const origin = remotes.find(r => r.name === 'origin');
  if (!origin || !origin.refs.fetch) {
    console.error('[GITHUB] Could not determine origin remote URL.');
    return;
  }
  // Parse owner/repo from remote URL (supports SSH and HTTPS)
  let owner: string | undefined, repo: string | undefined;
  const sshMatch = origin.refs.fetch.match(/git@[^:]+:([^/]+)\/([^.\/]+)(?:\.git)?$/);
  const httpsMatch = origin.refs.fetch.match(/https?:\/\/[^/]+\/([^/]+)\/([^.\/]+)(?:\.git)?$/);
  if (sshMatch) {
    owner = sshMatch[1];
    repo = sshMatch[2];
  } else if (httpsMatch) {
    owner = httpsMatch[1];
    repo = httpsMatch[2];
  } else {
    console.error('[GITHUB] Could not parse owner/repo from remote URL:', origin.refs.fetch);
    return;
  }

  for (const branch of branches) {
    // Check if a PR already exists from this branch to main
    const prs = await octokit.pulls.list({ owner, repo, head: `${owner}:${branch}`, base: 'main', state: 'open' });
    if (prs.data.length > 0) {
      console.log(`[GITHUB] PR already exists for branch: ${branch}`);
      continue;
    }
    // Create a new PR
    const title = `Update for launch: ${branch.replace('launch/', '')}`;
    const body = 'Automated update for launch data.';
    try {
      const pr = await octokit.pulls.create({
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
  console.log(`[GIT] Would commit and push global changes to main.`);
  // TODO: Implement using git.checkout('main'), git.add, git.commit, git.push
}
