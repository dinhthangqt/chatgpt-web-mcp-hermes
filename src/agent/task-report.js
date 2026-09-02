export function formatResultComment({ task, worker, branch, headSha, prUrl = "PENDING", tests = [], liveTest = "NOT_REQUIRED", unknown = [] }) {
  return ["HERMES_RESULT", `TASK-ID: ${task.taskId}`, "STATUS: READY_FOR_REVIEW", "", "ROOT_CAUSE:", task.problem, "", `BRANCH: ${branch}`, `HEAD_SHA: ${headSha || "PENDING"}`, `PR: ${prUrl}`, "", "FILES_CHANGED:", ...(task.files.length ? task.files.map((file) => `- ${file}`) : ["- none reported"]), "", "TESTS:", ...tests.map((test) => `- ${test}`), "", `LIVE_TEST: ${liveTest}`, "", "UNKNOWN:", ...(unknown.length ? unknown.map((item) => `- ${item}`) : ["- none"]), "", `WORKER: ${worker}`].join("\n");
}

export function formatDryRun(issue, task, branch) {
  return ["[DRY_RUN]", `ISSUE: #${issue.number}`, `TASK-ID: ${task.taskId}`, `PRIORITY: ${task.priority}`, `BASE-SHA: ${task.baseSha}`, "", "WOULD:", "claim issue", `create branch ${branch}`, "invoke Hermes execution workflow", "run tests", "open PR"].join("\n");
}
