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
  compactJournal,
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
test("old DELIVERY_UNKNOWN becomes a tombstone and still reconciles", async () => {
  const operation = createOperation({ operationId: "OLD", kind: "send", fingerprint: "fp-old" });
  const compacted = compactJournal({ operations: [transitionOperation(operation, "DELIVERY_UNKNOWN")] }, { unresolvedRetentionMs: 0, maxTombstones: 10, now: Date.now() + 1000 });
  assert.equal(compacted.operations.length, 0);
  assert.equal(compacted.tombstones[0].operationId, "OLD");
  assert.equal(reconcileOperation(compacted, "OLD", "fp-old").status, "reconcile");
});

test("same operationId conflicts through a tombstone and survives restart", async () => {
  const file = await tempFile();
  const operation = createOperation({ operationId: "OLD", kind: "send", fingerprint: "fp-old" });
  await writeOperationJournal(file, { operations: [transitionOperation(operation, "SUBMITTED")] }, 2, { unresolvedRetentionMs: 0 });
  const restarted = await readOperationJournal(file);
  assert.equal(reconcileOperation(restarted, "OLD", "fp-old").status, "reconcile");
  assert.equal(reconcileOperation(restarted, "OLD", "different").status, "conflict");
});

test("fingerprint recursively canonicalizes nested object keys and distinguishes payloads", () => {
  assert.equal(fingerprintPayload({ a: { x: 1, y: 2 } }), fingerprintPayload({ a: { y: 2, x: 1 } }));
  assert.notEqual(fingerprintPayload({ files: ["a"] }), fingerprintPayload({ files: ["b"] }));
});

test("thousands of terminal operations remain bounded while unresolved remain identifiable", () => {
  const unresolved = Array.from({ length: 5 }, (_, i) => createOperation({ operationId: `U-${i}`, kind: "send", fingerprint: `u-${i}` }));
  const terminal = Array.from({ length: 500 }, (_, i) => transitionOperation(createOperation({ operationId: `T-${i}`, kind: "send", fingerprint: `t-${i}` }), "COMPLETED"));
  const oldUnknown = Array.from({ length: 50 }, (_, i) => ({ ...transitionOperation(createOperation({ operationId: `D-${i}`, kind: "send", fingerprint: `d-${i}` }), "DELIVERY_UNKNOWN"), updatedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 }));
  const result = compactJournal({ operations: [...unresolved, ...terminal, ...oldUnknown] }, { unresolvedRetentionMs: 30 * 24 * 60 * 60 * 1000, maxTerminalEntries: 10, maxTombstones: 100, now: Date.now() + 1000 });
  for (const operation of [...unresolved, ...oldUnknown]) assert.notEqual(reconcileOperation(result, operation.operationId, operation.fingerprint).status, "new");
  assert.equal(result.operations.filter((item) => item.state === "COMPLETED").length, 10);
  assert.equal(result.tombstones.length, 50);
});
test("journal is bounded and atomically readable", async () => {
  const file = await tempFile();
  const operations = Array.from({ length: 4 }, (_, i) => transitionOperation(createOperation({ operationId: String(i), kind: "test", fingerprint: String(i) }), "COMPLETED"));
  await writeOperationJournal(file, { operations }, 2);
  const journal = await readOperationJournal(file);
  assert.deepEqual(journal.operations.map((x) => x.operationId), ["2", "3"]);
});
