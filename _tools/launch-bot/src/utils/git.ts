import simpleGit, { SimpleGit } from 'simple-git';
import type { Octokit } from '@octokit/rest';

export class Git {
  private git: SimpleGit;
  private octokitPromise: Promise<Octokit>;
  private repoPath: string;
  private targetBranch: string = 'main';

  constructor(repoPath: string, githubToken: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    this.octokitPromise = this.initOctokit(githubToken);
  }

  private async initOctokit(githubToken: string): Promise<Octokit> {
    const { Octokit } = await import('@octokit/rest');
    return new Octokit({ auth: githubToken });
  }

  /**
   * Checks out a branch
   * @param branchName The name of the branch to checkout
   */
  async checkout(branchName: string): Promise<void> {
    await this.git.checkout(branchName);
  }

  /**
   * Creates or checks out a branch for a launch file. If the branch doesn't exist,
   * creates it from the main branch.
   * @param launchFilename The filename of the launch file (can include .md extension, which will be removed)
   * @returns The branch name or null if the filename is invalid
   */
  async ensureLaunchBranch(launchFilename: string): Promise<string | null> {
    if (!launchFilename || launchFilename === 'undefined') {
      return null;
    }

    const baseName = launchFilename.replace(/\.md$/, '');
    const branchName = `launch/${baseName}`;
    
    // Check if branch exists
    const branches = await this.git.branchLocal();
    const branchExists = branches.all.includes(branchName);
    
    if (!branchExists) {
      // Create new branch from main
      await this.git.checkout(this.targetBranch);
      await this.git.pull('origin', this.targetBranch);
      await this.git.checkoutLocalBranch(branchName);
    } else {
      // Switch to existing branch
      await this.git.checkout(branchName);
    }
    
    return branchName;
  }

  /**
   * Commits changes in the current branch
   * @param message Commit message
   * @returns true if changes were committed, false if no changes to commit
   */
  async commitChanges(message: string): Promise<boolean> {
    await this.git.add('.');
    const status = await this.git.status();
    if (status.modified.length > 0 || status.not_added.length > 0) {
      await this.git.commit(message);
      return true;
    }
    return false;
  }

  /**
   * Pushes the current branch to remote
   */
  async pushCurrentBranch(): Promise<void> {
    const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
    await this.git.push('origin', currentBranch);
  }

  /**
   * Creates a pull request from the current branch to main branch
   * @param title PR title
   * @param body PR description
   */
  async createPullRequest(title: string, body: string): Promise<void> {
    const currentBranch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
    const repoInfo = await this.getRepoInfo();
    const octokit = await this.octokitPromise;

    await octokit.pulls.create({
      owner: repoInfo.owner,
      repo: repoInfo.name,
      title,
      body,
      head: currentBranch,
      base: this.targetBranch
    });
  }

  /**
   * Extracts owner and repo name from git remote URL
   */
  private async getRepoInfo(): Promise<{owner: string, name: string}> {
    const remotes = await this.git.getRemotes(true);
    const originUrl = remotes.find(remote => remote.name === 'origin')?.refs.fetch || '';
    
    // Handle both HTTPS and SSH formats
    // HTTPS: https://github.com/owner/repo.git
    // SSH: git@github.com:owner/repo.git
    const httpsMatch = originUrl.match(/github\.com[/:]([^/]+)\/([^.]+)(?:\.git)?$/);
    const sshMatch = originUrl.match(/git@github\.com:([^/]+)\/([^.]+)(?:\.git)?$/);
    const match = httpsMatch || sshMatch;

    if (!match) {
      throw new Error(`Could not parse repository info from remote URL: ${originUrl}`);
    }
    
    return {
      owner: match[1],
      name: match[2]
    };
  }
}