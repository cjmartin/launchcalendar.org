// git.ts
// Stubs for git and GitHub workflow integration using simple-git and octokit

import simpleGit, { SimpleGit } from 'simple-git';
import type { Octokit } from '@octokit/rest';
import path from 'path';

// Find the repo root (parent of _tools)
const repoRoot = path.resolve(__dirname, '../../../../');
const git: SimpleGit = simpleGit(repoRoot);

// Initialize octokit lazily to handle ESM import
let _octokit: Octokit | null = null;
async function getOctokit() {
  if (!_octokit) {
    // Dynamic import for ESM compatibility
    const { Octokit } = await import('@octokit/rest');
    _octokit = new Octokit();
  }
  return _octokit;
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
        await git.pull('origin', 'main');
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
export async function commitLaunchChanges(branchName: string, launchData: any) {
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
      console.log(`[GIT] ✓ Committed changes for branch: ${branchName}`);
    } else {
      console.log(`[GIT] No changes to commit for branch: ${branchName}`);
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
  console.log(`[GIT] Would push all launch branches to remote.`);
  // TODO: Implement using git.push
}

/**
 * Opens pull requests for each launch branch into main.
 */
export async function openPullRequestsForLaunchBranches() {
  console.log(`[GITHUB] Would open pull requests for each launch branch.`);
  // TODO: Implement using octokit.pulls.create
}

/**
 * Commits and pushes global file changes (like processed-articles.json) to main.
 */
export async function commitAndPushGlobalChanges() {
  console.log(`[GIT] Would commit and push global changes to main.`);
  // TODO: Implement using git.checkout('main'), git.add, git.commit, git.push
}
