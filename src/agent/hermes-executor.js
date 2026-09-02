import fs from "node:fs/promises";
import path from "node:path";

export function buildHermesExecutionContext({ task, issue, branch }) {
  return {
    taskId: task.taskId, priority: task.priority, baseSha: task.baseSha, branch,
    problem: task.problem, files: task.files, acceptance: task.acceptance,
    liveTestRequired: task.liveTest, issueNumber: issue.number, issueUrl: issue.url,
    rules: ["Do not push master directly", "Stay within task scope", "Inspect existing implementation before changing code", "Do not invent APIs or selectors", "Add regression tests for P0/P1 when practical", "Do not hide test failures", "Mark uncertain findings UNKNOWN"],
  };
}

export async function writeExecutionManifest(file, context, fsImpl = fs) {
  await fsImpl.mkdir(path.dirname(file), { recursive: true });
  await fsImpl.writeFile(file, `${JSON.stringify({ ...context, status: "CLAIMED" }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}
