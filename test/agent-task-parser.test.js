import test from "node:test";
import assert from "node:assert/strict";
import { branchForTask, parseTaskBody, validateTask } from "../src/agent/task-parser.js";

const body = `TASK-ID: CWM-42\r\nPRIORITY: P1\r\nBASE-SHA: 0123456789abcdef0123456789abcdef01234567\r\n\r\nFILES:\r\n- src/example.js\r\n\r\nPROBLEM:\r\nFirst line\r\nsecond line\r\n\r\nACCEPTANCE:\r\n- test passes\r\n- review diff\r\n\r\nLIVE-TEST: true\r\n\r\nNOTES:\r\ncontext\r\n`;

test("parser handles valid CRLF and multiline sections", () => {
  const task = parseTaskBody(body);
  assert.equal(task.taskId, "CWM-42"); assert.equal(task.priority, "P1"); assert.equal(task.liveTest, true);
  assert.deepEqual(task.files, ["src/example.js"]); assert.equal(task.acceptance.length, 2); assert.match(task.problem, /First line\nsecond line/);
});

test("parser rejects invalid identity and malicious path", () => {
  for (const field of ["TASK-ID: CWM-1 && del C:\\", "PRIORITY: P3", "BASE-SHA: nope"]) assert.throws(() => parseTaskBody(`${field}\nPROBLEM: x\nACCEPTANCE:\n- y`));
  assert.throws(() => validateTask({ taskId: "CWM-1", priority: "P1", baseSha: "0123456", files: ["../../secret"], problem: "x", acceptance: ["y"] }));
});

test("branch name derives only from validated task id", () => { assert.equal(branchForTask("CWM-42", "Fix API / race"), "hermes/CWM-42-fix-api-race"); assert.throws(() => branchForTask("CWM-1 && del C:")); });
