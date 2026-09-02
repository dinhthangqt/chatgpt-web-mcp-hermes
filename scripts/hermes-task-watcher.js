#!/usr/bin/env node
import path from "node:path";
import { AGENT_EXECUTION_ENABLED, AGENT_GH_COMMAND, AGENT_GIT_COMMAND, AGENT_POLL_MS, AGENT_REPO, AGENT_REPO_DIR, AGENT_WORKER_ID } from "../src/agent/config.js";
import { createGitHubTaskClient } from "../src/agent/github-task-client.js";
import { createGitRunner } from "../src/agent/git-runner.js";
import { runProcess } from "../src/agent/process-runner.js";
import { doctor, runOnce } from "../src/agent/task-runner.js";

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

function log(level, message) { process.stdout.write(`${new Date().toISOString()} ${level} ${message}\n`); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function makeDeps() {
  return {
    git: createGitRunner({ cwd: AGENT_REPO_DIR, command: AGENT_GIT_COMMAND }),
    github: createGitHubTaskClient({ cwd: AGENT_REPO_DIR, command: AGENT_GH_COMMAND, repo: AGENT_REPO }),
  };
}

async function main() {
  const deps = await makeDeps();
  const npmCli = process.platform === "win32"
    ? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
    : null;
  const npmCommand = process.platform === "win32" ? process.execPath : "npm";
  const npmArgs = process.platform === "win32" ? [npmCli, "--version"] : ["--version"];
  const npm = await runProcess(npmCommand, npmArgs, { cwd: AGENT_REPO_DIR });
  await doctor({ ...deps, npmVersion: npm.stdout.trim() });
  log("INFO", `watcher_start worker=${AGENT_WORKER_ID} execution=${AGENT_EXECUTION_ENABLED}`);
  if (process.argv.includes("--doctor")) return;
  do {
    const result = await runOnce({ ...deps, repoDir: AGENT_REPO_DIR });
    if (result.mode === "DRY_RUN") process.stdout.write(`${result.report}\n`);
    else if (result.mode === "IDLE") log("INFO", "no_ready_tasks");
    else log("INFO", `task_state mode=${result.mode} task=${result.task.taskId}`);
    if (process.argv.includes("--once")) return;
    if (!stopping) await sleep(AGENT_POLL_MS);
  } while (!stopping);
}

main().catch((error) => { log("ERROR", `${error.code || "WATCHER_ERROR"} ${error.message}`); process.exitCode = 1; });
