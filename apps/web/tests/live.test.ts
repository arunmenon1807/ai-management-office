// LIVE TEST against the real Claude Code runtime. Skipped unless `claude auth status` says signed in.
// Uses your subscription (one short Q&A turn). Run: npm run test:live
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.AIMO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bpo-live-"));
process.env.AIMO_ROOT = path.resolve(import.meta.dirname, "../../..");
const { authStatus } = await import("../src/lib/claude.ts");
const auth = await authStatus();

test("real Company Secretary turn returns an answer and a resumable session", { skip: !auth.loggedIn && "Claude Code is not signed in" }, async () => {
  const store = await import("../src/lib/store.ts");
  const { chatTurn } = await import("../src/lib/chat.ts");
  const c = store.createConversation("company-secretary");
  let result = "";
  for await (const e of chatTurn(c.id, "In one sentence: what is your role here, and which file defines you? Do not use any tools.")) if (e.type === "result") result = e.text;
  assert.ok(result.length > 20, "expected a real answer");
  assert.ok(store.getConversation(c.id)!.claude_session_id, "session id should be stored");
});
