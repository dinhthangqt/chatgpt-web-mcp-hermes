import { spawn } from "node:child_process";

const DEFAULT_OUTPUT_CAP = 200_000;
const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9_]+/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /(password|token|api[_-]?key)\s*[=:]\s*[^\s]+/gi,
];

export function redactSecrets(value = "") {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), String(value));
}

export function runProcess(command, args = [], {
  cwd,
  input = null,
  timeoutMs = 300_000,
  env = process.env,
  outputCap = DEFAULT_OUTPUT_CAP,
  spawnImpl = spawn,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let overflow = false;
    const append = (target, chunk) => {
      const next = target + chunk;
      if (next.length <= outputCap) return next;
      overflow = true;
      return next.slice(0, outputCap);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      const error = Object.assign(new Error(`Process timeout: ${command}`), { code: "PROCESS_TIMEOUT" });
      clearTimeout(timer);
      reject(error);
    }, timeoutMs);
    child.stdout?.setEncoding?.("utf8");
    child.stderr?.setEncoding?.("utf8");
    child.stdout?.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr?.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout: redactSecrets(stdout), stderr: redactSecrets(stderr), truncated: overflow });
    });
    if (input !== null && child.stdin) child.stdin.write(input);
    child.stdin?.end();
  });
}
