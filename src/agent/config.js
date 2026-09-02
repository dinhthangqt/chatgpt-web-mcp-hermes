import path from "node:path";
import { envInt } from "../../src/config.js";

export const AGENT_REPO = process.env.HERMES_GITHUB_REPO || "dinhthangqt/chatgpt-web-mcp-hermes";
export const AGENT_WORKER_ID = process.env.HERMES_WORKER_ID || "HERMES-PC-01";
export const AGENT_POLL_MS = envInt("HERMES_TASK_POLL_MS", 60_000, { min: 5_000, max: 86_400_000 });
export const AGENT_TASK_TIMEOUT_MS = envInt("HERMES_TASK_TIMEOUT_MS", 1_800_000, { min: 60_000, max: 7_200_000 });
export const AGENT_EXECUTION_ENABLED = /^(1|true|yes)$/i.test(process.env.HERMES_TASK_EXECUTION_ENABLED || "false");
export const AGENT_REPO_DIR = path.resolve(process.env.HERMES_REPO_DIR || process.cwd());
export const AGENT_GH_COMMAND = process.env.HERMES_GH_COMMAND || (process.platform === "win32" ? "gh.exe" : "gh");
export const AGENT_GIT_COMMAND = process.env.HERMES_GIT_COMMAND || (process.platform === "win32" ? "git.exe" : "git");
export const AGENT_MANIFEST = path.join(AGENT_REPO_DIR, ".agent", "runtime", "current-task.json");
