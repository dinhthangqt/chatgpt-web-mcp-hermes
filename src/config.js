import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const CHATGPT_URL = process.env.CHATGPT_WEB_URL || "https://chatgpt.com/";

export const USER_DATA_DIR = path.resolve(
  process.env.CHATGPT_WEB_PROFILE ||
    path.join(os.homedir(), ".chatgpt-web-mcp", "chrome-profile"),
);

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

export function envInt(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}; got ${raw}`);
  }
  return value;
}

export function chromeExecutableCandidates({
  platform = process.platform,
  env = process.env,
  home = os.homedir(),
} = {}) {
  if (env.CHATGPT_WEB_CHROME) {
    return [platform === process.platform ? path.resolve(env.CHATGPT_WEB_CHROME) : env.CHATGPT_WEB_CHROME];
  }

  if (platform === "darwin") {
    return unique([
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      path.join(home, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
      path.join(home, "Applications/Chromium.app/Contents/MacOS/Chromium"),
    ]);
  }

  if (platform === "win32") {
    return unique([
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
      env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
      env["PROGRAMFILES(X86)"] &&
        path.join(env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
      env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Microsoft/Edge/Application/msedge.exe"),
      env["PROGRAMFILES(X86)"] &&
        path.join(env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
    ]);
  }

  const pathEntries = String(env.PATH || "")
    .split(path.delimiter)
    .filter(Boolean);
  const executableNames = [
    "google-chrome-stable",
    "google-chrome",
    "chromium",
    "chromium-browser",
    "microsoft-edge-stable",
    "microsoft-edge",
  ];
  return unique(
    pathEntries.flatMap((directory) =>
      executableNames.map((name) => path.join(directory, name)),
    ),
  );
}

export function resolveChromeExecutable(options = {}) {
  const candidates = chromeExecutableCandidates(options);
  const env = options.env || process.env;
  if (env.CHATGPT_WEB_CHROME) return candidates[0] || null;
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

export const CHROME_EXECUTABLE = resolveChromeExecutable();

export const HEADLESS = /^(1|true|yes)$/i.test(
  process.env.CHATGPT_WEB_HEADLESS || "false",
);

export const ACTION_TIMEOUT_MS = envInt(
  "CHATGPT_WEB_ACTION_TIMEOUT_MS",
  20_000,
  { min: 1_000, max: 900_000 },
);

export const RESPONSE_TIMEOUT_MS = envInt(
  "CHATGPT_WEB_RESPONSE_TIMEOUT_MS",
  300_000,
  { min: 5_000, max: 3_600_000 },
);

export const RECONNECT_DELAY_MS = Number(
  process.env.CHATGPT_WEB_RECONNECT_DELAY_MS || 5_000,
);

export const SITE_ACTION_INTERVAL_MS = Number(
  process.env.CHATGPT_WEB_SITE_ACTION_INTERVAL_MS || 5_000,
);

export const PAGE_INTERACTION_INTERVAL_MS = Number(
  process.env.CHATGPT_WEB_PAGE_INTERACTION_INTERVAL_MS || 1_000,
);

export const SEND_INTERVAL_MS = Number(
  process.env.CHATGPT_WEB_SEND_INTERVAL_MS || 30_000,
);

export const CONVERSATION_CHANGE_INTERVAL_MS = Number(
  process.env.CHATGPT_WEB_CONVERSATION_CHANGE_INTERVAL_MS || 30_000,
);

export const POST_RESPONSE_CONVERSATION_COOLDOWN_MS = Number(
  process.env.CHATGPT_WEB_POST_RESPONSE_CONVERSATION_COOLDOWN_MS || 30_000,
);

export const POST_BREAKER_COOLDOWN_MS = Number(
  process.env.CHATGPT_WEB_POST_BREAKER_COOLDOWN_MS || 5 * 60_000,
);

export const HISTORY_QUIET_PERIOD_MS = Number(
  process.env.CHATGPT_WEB_HISTORY_QUIET_PERIOD_MS || 5 * 60_000,
);

export const AUTH_CACHE_MS = Number(
  process.env.CHATGPT_WEB_AUTH_CACHE_MS || 10 * 60_000,
);

export const PRO_PROBE_RECHECK_AFTER_CLOSE_MS = Number(
  process.env.CHATGPT_WEB_PRO_RECHECK_AFTER_CLOSE_MS || 3 * 60 * 60_000,
);

export const DEFAULT_ANSWER_TIER =
  process.env.CHATGPT_WEB_DEFAULT_TIER || "极高";

export const PRO_ANSWER_TIER =
  process.env.CHATGPT_WEB_PRO_TIER || "Pro";

export const PROBE_PROMPT =
  process.env.CHATGPT_WEB_PROBE_PROMPT || "你是什么模型？";

export const PROBE_ACCEPT_CLASSIFICATION =
  process.env.CHATGPT_WEB_PROBE_ACCEPT_ID || "gpt-5.6-pro";

export const PROBE_FALLBACK_CLASSIFICATION =
  process.env.CHATGPT_WEB_PROBE_FALLBACK_ID || "gpt-5.5-mini";

export const PROBE_ACCEPT_PATTERN =
  process.env.CHATGPT_WEB_PROBE_ACCEPT_PATTERN ||
  "gpt\\s*[- ]?5[.．]6\\s*[- ]?pro|5[.．]6\\s*[- ]?pro";

export const PROBE_FALLBACK_PATTERN =
  process.env.CHATGPT_WEB_PROBE_FALLBACK_PATTERN ||
  "gpt\\s*[- ]?5[.．]5\\s*[- ]?mini|5[.．]5\\s*[- ]?mini";

export const PROBE_POLICY_KEY = [
  PRO_ANSWER_TIER,
  PROBE_PROMPT,
  PROBE_ACCEPT_CLASSIFICATION,
  PROBE_FALLBACK_CLASSIFICATION,
  PROBE_ACCEPT_PATTERN,
  PROBE_FALLBACK_PATTERN,
].join("\n");

export const BROWSER_STATE_FILE = path.resolve(
  process.env.CHATGPT_WEB_BROWSER_STATE ||
    path.join(os.homedir(), ".chatgpt-web-mcp", "browser-state.json"),
);

export const RUNTIME_STATE_FILE = path.resolve(
  process.env.CHATGPT_WEB_RUNTIME_STATE ||
    path.join(os.homedir(), ".chatgpt-web-mcp", "runtime-state.json"),
);

export const RUNTIME_LOCK_FILE = `${RUNTIME_STATE_FILE}.lock`;

export const UPLOAD_ROOTS = (process.env.CHATGPT_WEB_UPLOAD_ROOTS || path.join(os.homedir(), "Downloads"))
  .split(path.delimiter)
  .filter(Boolean)
  .map((item) => path.resolve(item));

export const OPERATION_JOURNAL_FILE = path.resolve(
  process.env.CHATGPT_WEB_OPERATION_JOURNAL ||
    path.join(os.homedir(), ".chatgpt-web-mcp", "operation-journal.json"),
);

export const OPERATION_JOURNAL_MAX_ENTRIES = envInt(
  "CHATGPT_WEB_OPERATION_JOURNAL_MAX_ENTRIES",
  100,
  { min: 1, max: 100_000 },
);

export const OPERATION_JOURNAL_UNRESOLVED_RETENTION_MS = envInt(
  "CHATGPT_WEB_OPERATION_JOURNAL_UNRESOLVED_RETENTION_MS",
  30 * 24 * 60 * 60 * 1000,
  { min: 60_000, max: 365 * 24 * 60 * 60 * 1000 },
);

export const OPERATION_JOURNAL_MAX_TOMBSTONES = envInt(
  "CHATGPT_WEB_OPERATION_JOURNAL_MAX_TOMBSTONES",
  10_000,
  { min: 100, max: 1_000_000 },
);

export const OPERATION_LOCK_FILE = path.resolve(
  process.env.CHATGPT_WEB_OPERATION_LOCK ||
    path.join(os.homedir(), ".chatgpt-web-mcp", "browser-operation.lock"),
);

export const NETWORK_LOG_FILE = path.resolve(
  process.env.CHATGPT_WEB_NETWORK_LOG ||
    path.join(os.homedir(), ".chatgpt-web-mcp", "network-diagnostics.jsonl"),
);

export const MAX_HISTORY_RESULTS = 50;
