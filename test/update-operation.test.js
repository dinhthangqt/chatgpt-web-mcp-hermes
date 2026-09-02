import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { createOperation } from "../src/operation-journal.js";

 test("updateOperation returns the transitioned operation, not the journal", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "chatgpt-web-mcp-update-"));
  process.env.CHATGPT_WEB_OPERATION_JOURNAL = path.join(dir, "journal.json");
  const { ChatGPTBrowser } = await import(`../src/browser.js?update-contract=${Date.now()}`);
  const browser = new ChatGPTBrowser();
  const operation = createOperation({ operationId: "contract-A", kind: "send", fingerprint: "fp-A" });
  const updated = await browser.updateOperation(operation, "SUBMITTED");
  assert.equal(updated.operationId, "contract-A");
  assert.equal(updated.state, "SUBMITTED");
  assert.equal("operations" in updated, false);
  assert.equal("tombstones" in updated, false);
});
