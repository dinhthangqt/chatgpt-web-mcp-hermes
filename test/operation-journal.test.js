import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import {
  createOperation,
  fingerprintPayload,
  readOperationJournal,
  recordOperation,
  reconcileOperation,
  transitionOperation,
  writeOperationJournal,
} from "../src/operation-journal.js";

async function tempFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "chatgpt-web-mcp-journal-"));
  return path.join(dir, "operation-journal.json");
}

test("journal preserves A then B and reconciles retry A after restart", async () => {
  const file = await tempFile();
  const a = createOperation({ operationId: "A", kind: "send", fingerprint: fingerprintPayload({ prompt: "a" }) });
  await recordOperation(file, transitionOperation(a, "SUBMITTED"));
  const b = createOperation({ operationId: "B", kind: "send", fingerprint: fingerprintPayload({ prompt: "b" }) });
  await recordOperation(file, transitionOperation(b, "COMPLETED"));
  const restarted = await readOperationJournal(file);
  assert.equal(restarted.operations.length, 2);
  assert.equal(reconcileOperation(restarted, "A", a.fingerprint).status, "reconcile");
});

test("same operationId with a different fingerprint is a conflict", async () => {
  const file = await tempFile();
  const a = createOperation({ operationId: "A", kind: "send", fingerprint: fingerprintPayload({ prompt: "a" }) });
  await recordOperation(file, a);
  assert.equal(reconcileOperation(await readOperationJournal(file), "A", fingerprintPayload({ prompt: "other" })).status, "conflict");
});

test("DELIVERY_UNKNOWN is never classified as resumable send", async () => {
  const file = await tempFile();
  const a = createOperation({ operationId: "A", kind: "move", fingerprint: fingerprintPayload({ project: "p" }) });
  await recordOperation(file, transitionOperation(a, "DELIVERY_UNKNOWN"));
  assert.equal(reconcileOperation(await readOperationJournal(file), "A", a.fingerprint).status, "reconcile");
});

test("pruning keeps updated unresolved operations and only prunes old terminal entries", async () => {
  const file = await tempFile();
  const a = createOperation({ operationId: "A", kind: "send", fingerprint: "a" });
  await recordOperation(file, transitionOperation(a, "SUBMITTED"));
  for (const id of ["B", "C", "D"]) await recordOperation(file, transitionOperation(createOperation({ operationId: id, kind: "send", fingerprint: id }), "COMPLETED"));
  const updatedA = transitionOperation(a, "DELIVERY_UNKNOWN");
  await recordOperation(file, updatedA, 2);
  const journal = await readOperationJournal(file);
  assert.equal(reconcileOperation(journal, "A", "a").status, "reconcile");
  assert.equal(journal.operations.find((item) => item.operationId === "A")?.state, "DELIVERY_UNKNOWN");
});
test("journal is bounded and atomically readable", async () => {
  const file = await tempFile();
  const operations = Array.from({ length: 4 }, (_, i) => transitionOperation(createOperation({ operationId: String(i), kind: "test", fingerprint: String(i) }), "COMPLETED"));
  await writeOperationJournal(file, { operations }, 2);
  const journal = await readOperationJournal(file);
  assert.deepEqual(journal.operations.map((x) => x.operationId), ["2", "3"]);
});
