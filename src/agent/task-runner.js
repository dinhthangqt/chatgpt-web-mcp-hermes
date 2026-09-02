import fs from "node:fs/promises";
import path from "node:path";
import { AGENT_EXECUTION_ENABLED, AGENT_MANIFEST, AGENT_REPO, AGENT_TASK_TIMEOUT_MS, AGENT_WORKER_ID } from "./config.js";
import { branchForTask, parseTaskBody } from "./task-parser.js";
import { assertSuccessful, createGitRunner } from "./git-runner.js";
import { buildHermesExecutionContext, writeExecutionManifest } from "./hermes-executor.js";
import { formatDryRun, formatResultComment } from "./task-report.js";

export async function doctor({ git, github, nodeVersion = process.version, npmVersion = "unknown" } = {}) {
  const checks = {};
  checks.node = nodeVersion;
  checks.npm = npmVersion;
  checks.git = await git.git(["--version"]);
  checks.gh = await github.doctor();
  checks.remote = await git.remote();
  checks.status = await git.status();
  const remote = checks.remote.stdout.trim();
  if (!/github\.com[/:]dinhthangqt\/chatgpt-web-mcp-hermes(?:\.git)?$/i.test(remote)) throw new Error(`BLOCKED: unexpected origin remote: ${remote}`);
  if (checks.status.stdout.trim()) throw Object.assign(new Error("DIRTY_WORKTREE"), { code: "DIRTY_WORKTREE" });
  for (const result of [checks.git, checks.gh.version, checks.gh.auth, checks.remote, checks.status]) assertSuccessful(result, "doctor check");
  return checks;
}

export async function prepareTask({ issue, git, github, repoDir, workerId = AGENT_WORKER_ID, executionEnabled = AGENT_EXECUTION_ENABLED, manifest = AGENT_MANIFEST }) {
  const task = parseTaskBody(issue.body || "");
  const branch = branchForTask(task.taskId, issue.title);
  if (!executionEnabled) return { mode: "DRY_RUN", task, branch, report: formatDryRun(issue, task, branch) };
  await github.editLabels(issue.number, "status:ready", "status:running");
  await github.comment(issue.number, [`HERMES_CLAIM`, `TASK-ID: ${task.taskId}`, `WORKER: ${workerId}`, `CLAIMED-AT: ${new Date().toISOString()}`, `BASE-SHA: ${task.baseSha}`].join("\n"));
  assertSuccessful(await git.fetch(), "git fetch");
  assertSuccessful(await git.checkoutMaster(), "git checkout master");
  assertSuccessful(await git.pullFastForward(), "git pull --ff-only");
  const currentMaster = await git.head();
  if (currentMaster.toLowerCase() !== task.baseSha.toLowerCase()) {
    await github.editLabels(issue.number, "status:running", "status:blocked");
    await github.comment(issue.number, [`BLOCKED_BASE_MOVED`, `TASK-ID: ${task.taskId}`, `EXPECTED_BASE: ${task.baseSha}`, `CURRENT_MASTER: ${currentMaster}`].join("\n"));
    return { mode: "BLOCKED", task, branch, currentMaster };
  }
  assertSuccessful(await git.createBranch(branch), "create task branch");
  const context = buildHermesExecutionContext({ task, issue, branch });
  await writeExecutionManifest(manifest, context);
  await github.comment(issue.number, [`HERMES_MANIFEST_READY`, `TASK-ID: ${task.taskId}`, `BRANCH: ${branch}`, `MANIFEST: ${path.relative(repoDir, manifest)}`, `TIMEOUT_MS: ${AGENT_TASK_TIMEOUT_MS}`, "HERMES_SELF_INVOCATION: NOT_SUPPORTED", "NEXT: current Hermes runtime consumes the manifest; watcher will not execute arbitrary Issue commands."].join("\n"));
  return { mode: "MANIFEST_READY", task, branch, manifest };
}

export async function runOnce({ git, github, repoDir, ...options }) {
  const ready = await github.findReadyTasks();
  if (!ready.length) return { mode: "IDLE", count: 0 };
  const issue = ready.slice().sort((a, b) => a.number - b.number)[0];
  const fullIssue = issue.body ? issue : await github.getIssue(issue.number);
  return prepareTask({ issue: fullIssue, git, github, repoDir, ...options });
}

export { formatResultComment };
