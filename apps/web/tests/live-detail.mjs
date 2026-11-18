// Manual live check (real runtime, uses plan limits). Run: node --experimental-strip-types tests/live-detail.mjs
// Checks: warm-process memory, memory after process restart (--resume), read-only Drive access for
// the Chief of Staff and for specialists, and delegation capture (+ handoff text).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.AIMO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bpo-live2-"));
process.env.AIMO_ROOT = path.resolve(import.meta.dirname, "../../..");
const store = await import("../src/lib/store.ts");
const { chatTurn, buildHandoff } = await import("../src/lib/chat.ts");
const { stopConversationProcess, stopAllProcesses } = await import("../src/lib/claude.ts");

const ask = async (cid, p) => {
  const t = Date.now(); let r = null, err = null;
  for await (const e of chatTurn(cid, p)) { if (e.type === "result") r = e; if (e.type === "error") err = e.message; }
  return { secs: ((Date.now() - t) / 1000).toFixed(1), text: r?.text.slice(0, 260), denials: [...new Set(r?.denials ?? [])], err };
};
const DRIVE = "Search my Google Drive (read-only, create nothing) for a folder whose name contains 'Company Docs'. Answer in one line: could you search (yes/no) and the folder name.";

const cos = store.createConversation("chief-of-staff");
stopConversationProcess(cos.id);
stopConversationProcess(cos.id);

for (const agent of ["company-secretary", "cto", "marketing-growth"]) {
  const c = store.createConversation(agent);
  console.log("DRIVE", agent, JSON.stringify(await ask(c.id, DRIVE)));
  stopConversationProcess(c.id);
}

const d = store.createConversation("chief-of-staff");
console.log("DELEGATE", JSON.stringify(await ask(d.id, "Ask the company-secretary agent to search Drive (read-only) for the folder 'Company Docs' and report only its name. Then answer me in one line.")));
const m = store.getMessages(d.id).find((x) => x.role === "assistant");
const del = m ? JSON.parse(m.meta).delegations : [];
console.log("DELEGATIONS", JSON.stringify(del.map((x) => ({ agent: x.agent, steps: x.steps.length, resultHead: x.result.slice(0, 120) }))));
if (del[0]) console.log("HANDOFF", buildHandoff("(request)", del[0]).slice(0, 300));
stopAllProcesses();
