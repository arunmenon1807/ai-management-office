import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.AIMO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bpo-plain-"));
const store = await import("../src/lib/store.ts");

// Regression: pages crashed ("Only plain objects ... Client Components") once rows existed.
test("rows are plain objects so they can cross the server/client boundary", () => {
  const c = store.createConversation("cfo");
  store.addMessage(c.id, "user", "hi");
  store.createTask({ title: "t" });
  for (const row of [store.getConversation(c.id), ...store.getMessages(c.id), ...store.listTasks(), ...store.listConversations()]) {
    assert.equal(Object.getPrototypeOf(row), Object.prototype);
  }
});
