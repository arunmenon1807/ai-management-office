// Manual live check (real runtime, uses plan limits). Run: node --experimental-strip-types tests/live-delegation.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
process.env.AIMO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bpo-live3-"));
process.env.AIMO_ROOT = path.resolve(import.meta.dirname, "../../..");
const store = await import("../src/lib/store.ts");
const { chatTurn, generateReport } = await import("../src/lib/chat.ts");

const c = store.createConversation("chief-of-staff");
let r = null, err = null;
const t0 = Date.now();
for await (const e of chatTurn(c.id, "What corporate compliance obligations should I be thinking about this month? Use the right specialist.")) {
  if (e.type === "result") r = e;
  if (e.type === "error") err = e.message;
}
const msg = store.getMessages(c.id).find((m) => m.role === "assistant");
const meta = msg ? JSON.parse(msg.meta) : {};
console.log("DELEGATION", JSON.stringify({ err, secs: Math.round((Date.now() - t0) / 1000), tools: meta.tools, denials: meta.denials, cost: meta.costUsd, answerHead: msg?.content.slice(0, 700) }, null, 1));

const c2 = store.createConversation("chief-of-staff", "Report: daily-brief");
const t1 = Date.now();
const rep = await generateReport("daily-brief", c2.id, "daily-brief", "daily-brief test");
console.log("REPORT", JSON.stringify({ rep, secs: Math.round((Date.now() - t1) / 1000) }));
if (!("error" in rep)) {
  const v = store.getReportVersions(rep.id)[0];
  console.log("REPORT_SOURCES", v.sources, "\nREPORT_HEAD", v.content.slice(0, 1200));
}
