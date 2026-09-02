import { AGENT_GIT_COMMAND } from "./config.js";
import { runProcess } from "./process-runner.js";

export function createGitRunner({ cwd, processRunner = runProcess, command = AGENT_GIT_COMMAND } = {}) {
  const git = (args, options = {}) => processRunner(command, args, { cwd, ...options });
  return {
    git,
    async status() { return git(["status", "--porcelain"]); },
    async remote() { return git(["remote", "get-url", "origin"]); },
    async head() { const result = await git(["rev-parse", "HEAD"]); return result.stdout.trim(); },
    async fetch() { return git(["fetch", "origin", "--prune"]); },
    async checkoutMaster() { return git(["checkout", "master"]); },
    async pullFastForward() { return git(["pull", "--ff-only", "origin", "master"]); },
    async createBranch(branch) { return git(["checkout", "-b", branch]); },
    async checkout(branch) { return git(["checkout", branch]); },
    async push(branch) { return git(["push", "-u", "origin", branch]); },
  };
}

export function assertSuccessful(result, description) {
  if (!result || result.code !== 0) throw new Error(`${description} failed: ${(result?.stderr || result?.stdout || "unknown error").trim()}`);
  return result;
}
