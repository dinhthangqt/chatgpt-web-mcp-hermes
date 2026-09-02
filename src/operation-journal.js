import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const OPERATION_STATES = new Set([
  "PREPARED",
  "SUBMITTING",
  "SUBMITTED",
  "GENERATING",
  "COMPLETED",
  "FAILED_BEFORE_SUBMIT",
  "DELIVERY_UNKNOWN",
]);

const TERMINAL_STATES = new Set(["COMPLETED", "FAILED_BEFORE_SUBMIT"]);

export function fingerprintPayload(value) {
  return createHash("sha256")
    .update(JSON.stringify(value, Object.keys(value || {}).sort()), "utf8")
    .digest("hex");
}

export function createOperation({ operationId = randomUUID(), kind, fingerprint, promptHash = null }) {
  if (!kind || !fingerprint) throw new Error("kind and fingerprint are required");
  const now = Date.now();
  return { operationId, kind, fingerprint, promptHash, state: "PREPARED", createdAt: now, updatedAt: now };
}

export function transitionOperation(operation, state, extra = {}) {
  if (!OPERATION_STATES.has(state)) throw new Error(`Unknown operation state: ${state}`);
  if (TERMINAL_STATES.has(operation.state) && operation.state !== state) {
    throw new Error(`Cannot transition terminal operation ${operation.state}`);
  }
  return { ...operation, ...extra, state, updatedAt: Date.now() };
}

export function reconcileOperation(journal, operationId, fingerprint) {
  const operation = journal.operations.find((item) => item.operationId === operationId);
  if (!operation) return { status: "new", operation: null };
  if (operation.fingerprint !== fingerprint) return { status: "conflict", operation };
  if (["SUBMITTING", "SUBMITTED", "GENERATING", "DELIVERY_UNKNOWN"].includes(operation.state)) {
    return { status: "reconcile", operation };
  }
  if (operation.state === "COMPLETED") return { status: "completed", operation };
  return { status: "resume", operation };
}

export async function readOperationJournal(file) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    if (!Array.isArray(parsed.operations)) throw new Error("operations must be an array");
    return { version: 1, maxEntries: Number(parsed.maxEntries) || 100, operations: parsed.operations };
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, maxEntries: 100, operations: [] };
    throw new Error(`Operation journal is corrupt: ${error.message}`);
  }
}

export async function writeOperationJournal(file, journal, maxEntries = 100) {
  const unresolved = journal.operations.filter((item) => !TERMINAL_STATES.has(item.state));
  const terminal = journal.operations
    .filter((item) => TERMINAL_STATES.has(item.state))
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(-maxEntries);
  const bounded = {
    version: 1,
    maxEntries,
    operations: [...unresolved, ...terminal],
  };
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, "w", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(bounded, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, file);
  return bounded;
}

export async function recordOperation(file, operation, maxEntries = 100) {
  const journal = await readOperationJournal(file);
  journal.operations = journal.operations.filter((item) => item.operationId !== operation.operationId);
  journal.operations.push(operation);
  return writeOperationJournal(file, journal, maxEntries);
}
