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

export const RECONCILE_STATES = new Set([
  "SUBMITTING",
  "SUBMITTED",
  "GENERATING",
  "DELIVERY_UNKNOWN",
]);

export const TERMINAL_STATES = new Set(["COMPLETED", "FAILED_BEFORE_SUBMIT"]);

export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function fingerprintPayload(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
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

function operationState(item) {
  return item.state || item.lastState;
}

export function toTombstone(operation) {
  return {
    operationId: operation.operationId,
    kind: operation.kind,
    fingerprint: operation.fingerprint,
    lastState: operation.state,
    updatedAt: operation.updatedAt,
  };
}

function dedupeNewestTombstones(items) {
  const newest = new Map();
  for (const item of items) {
    const current = newest.get(item.operationId);
    if (!current || Number(item.updatedAt) >= Number(current.updatedAt)) newest.set(item.operationId, item);
  }
  return [...newest.values()].sort((a, b) => Number(a.updatedAt) - Number(b.updatedAt));
}

export function compactJournal(journal, {
  maxTerminalEntries = journal.maxEntries || 100,
  unresolvedRetentionMs = 30 * 24 * 60 * 60 * 1000,
  maxTombstones = 10_000,
  now = Date.now(),
} = {}) {
  const active = [];
  const terminal = [];
  const tombstones = [...(journal.tombstones || [])];
  for (const operation of journal.operations || []) {
    const age = Math.max(0, now - Number(operation.updatedAt || now));
    if (!TERMINAL_STATES.has(operation.state)) {
      if (age <= unresolvedRetentionMs) active.push(operation);
      else tombstones.push(toTombstone(operation));
    } else {
      terminal.push(operation);
    }
  }
  terminal.sort((a, b) => Number(a.updatedAt) - Number(b.updatedAt));
  terminal.splice(0, Math.max(0, terminal.length - maxTerminalEntries));
  return {
    version: 2,
    maxEntries: maxTerminalEntries,
    operations: [...active, ...terminal.slice(0, maxTerminalEntries)],
    tombstones: dedupeNewestTombstones(tombstones).slice(-maxTombstones),
  };
}

export function reconcileOperation(journal, operationId, fingerprint) {
  const operation =
    (journal.operations || []).find((item) => item.operationId === operationId) ||
    (journal.tombstones || []).find((item) => item.operationId === operationId);
  if (!operation) return { status: "new", operation: null };
  if (operation.fingerprint !== fingerprint) return { status: "conflict", operation };
  const state = operationState(operation);
  if (RECONCILE_STATES.has(state)) return { status: "reconcile", operation };
  if (state === "COMPLETED") return { status: "completed", operation };
  if (state === "FAILED_BEFORE_SUBMIT") return { status: "resume", operation };
  return { status: "reconcile", operation };
}

export async function readOperationJournal(file) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    if (!Array.isArray(parsed.operations)) throw new Error("operations must be an array");
    return {
      version: Number(parsed.version) >= 2 ? 2 : 1,
      maxEntries: Number(parsed.maxEntries) || 100,
      operations: parsed.operations,
      tombstones: Array.isArray(parsed.tombstones) ? parsed.tombstones : [],
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 2, maxEntries: 100, operations: [], tombstones: [] };
    throw new Error(`Operation journal is corrupt: ${error.message}`);
  }
}

export async function writeOperationJournal(file, journal, maxEntries = 100, options = {}) {
  const bounded = compactJournal(
    { ...journal, maxEntries },
    { ...options, maxTerminalEntries: maxEntries },
  );
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporary, "w", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(bounded, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporary, file);
  } catch (error) {
    if (!['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(error?.code)) throw error;
    await fs.copyFile(temporary, file);
    await fs.unlink(temporary).catch(() => {});
  }
  return bounded;
}

export async function recordOperation(file, operation, maxEntries = 100, options = {}) {
  const journal = await readOperationJournal(file);
  journal.operations = journal.operations.filter((item) => item.operationId !== operation.operationId);
  journal.tombstones = (journal.tombstones || []).filter((item) => item.operationId !== operation.operationId);
  journal.operations.push(operation);
  return writeOperationJournal(file, journal, maxEntries, options);
}
