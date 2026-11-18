// Unit/integration tests. These use NO Claude runtime and NO mocks of it: they exercise real
// SQLite files in a temp dir and the real repo definitions. Real-agent tests: see live.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bpo-test-"));
process.env.AIMO_DATA_DIR = tmp;
const root = path.resolve(import.meta.dirname, "../../..");
process.env.AIMO_ROOT = root;

const { listAgents, listSkills, parseFrontmatter, readOnlyMcpTools } =await import("../src/lib/agents.ts");
const store = await import("../src/lib/store.ts");
const { closeDb, getDb, integrityCheck } = await import("../src/lib/db.ts");
const { safeResolve, checkRequest, isSecretFile } = await import("../src/lib/security.ts");
const { buildArgs, childEnv } = await import("../src/lib/claude.ts");
const docs = await import("../src/lib/documents.ts");

test("agent discovery reads real .claude/agents and CLAUDE.md", () => {
  const agents = listAgents(root);
  const slugs = agents.map((a) => a.slug);
  for (const s of ["chief-of-staff", "company-secretary", "cfo", "cto", "chartered-accountant", "product-manager", "marketing-growth"]) assert.ok(slugs.includes(s), s);
  const cs = agents.find((a) => a.slug === "company-secretary")!;
  assert.equal(cs.status, "ok");
  assert.ok(cs.tools.length > 0 && cs.description.length > 20);
  assert.ok(cs.integrations.includes("Google Drive"));
});
test("misconfigured agent is reported, not hidden", () => {
  const d = fs.mkdtempSync(path.join(tmp, "repo-"));
  fs.mkdirSync(path.join(d, ".claude/agents"), { recursive: true });
  fs.writeFileSync(path.join(d, "CLAUDE.md"), "x");
  fs.writeFileSync(path.join(d, ".claude/agents/bad.md"), "---\nname: bad\n---\n# Bad\n");
  const bad = listAgents(d).find((a) => a.slug === "bad")!;
  assert.equal(bad.status, "error");
  assert.match(bad.statusNote, /missing description/);
});
test("skills discovered", () => assert.ok(listSkills(root).some((s) => s.slug === "daily-brief")));
test("frontmatter parser", () => assert.deepEqual(parseFrontmatter("---\na: \"b\"\n---\nbody").data, { a: "b" }));

test("conversations persist across DB reopen; rename; delete", () => {
  const c = store.createConversation("cfo", "t1");
  store.addMessage(c.id, "user", "hello");
  store.setSession(c.id, "sess-123");
  closeDb(); // simulate app restart
  const again = store.getConversation(c.id)!;
  assert.equal(again.claude_session_id, "sess-123");
  assert.equal(store.getMessages(c.id).length, 1);
  store.renameConversation(c.id, "renamed");
  assert.equal(store.getConversation(c.id)!.title, "renamed");
  assert.equal(store.listConversations("hello").length, 1);
  store.deleteConversation(c.id);
  assert.equal(store.getConversation(c.id), undefined);
});
test("sessions are not mixed between conversations", () => {
  const a = store.createConversation("cfo"), b = store.createConversation("cto");
  store.setSession(a.id, "A"); store.setSession(b.id, "B");
  assert.equal(store.getConversation(a.id)!.claude_session_id, "A");
  assert.equal(store.getConversation(b.id)!.claude_session_id, "B");
});

test("tasks: validation, create, update, completion date", () => {
  assert.ok(store.validateTask({}));
  assert.ok(store.validateTask({ title: "x", status: "bogus" }));
  assert.ok(store.validateTask({ title: "x", due_date: "13/11/2026" }));
  const t = store.createTask({ title: "File thing", priority: "high", due_date: "2026-12-01" });
  assert.equal(t.status, "proposed");
  const done = store.updateTask(t.id, { status: "completed" })!;
  assert.ok(done.completed_at);
  assert.equal(store.updateTask(t.id, { status: "blocked" })!.completed_at, null);
});

test("reports: versions preserved, search, unknown id rejected", () => {
  const r1 = store.saveReport({ kind: "daily-brief", title: "Brief", content: "alpha SRC-001", agent: "chief-of-staff" });
  const r2 = store.saveReport({ kind: "daily-brief", title: "Brief", content: "beta", report_id: r1.id });
  assert.equal(r2.version, 2);
  assert.equal(store.getReportVersions(r1.id).length, 2);
  assert.equal(store.listReports("alpha").length, 1);
  assert.throws(() => store.saveReport({ kind: "x", title: "y", content: "z", report_id: "nope" }));
});

test("approvals: single use, exact payload, no use before approval or after rejection", () => {
  const a = store.requestApproval({ kind: "email", title: "Send", details: "Dear X" });
  assert.throws(() => store.consumeApproval(a.id, "email", "Dear X"), /pending/);
  store.decideApproval(a.id, "approved");
  assert.throws(() => store.consumeApproval(a.id, "email", "Dear X, altered"), /differs/);
  store.consumeApproval(a.id, "email", "Dear X");
  assert.throws(() => store.consumeApproval(a.id, "email", "Dear X"), /executed/); // replay blocked
  const r = store.requestApproval({ kind: "payment", title: "Pay", details: "100" });
  store.decideApproval(r.id, "rejected");
  assert.throws(() => store.consumeApproval(r.id, "payment", "100"), /rejected/);
  assert.throws(() => store.decideApproval(r.id, "approved"), /not pending/); // cannot flip decision
});

test("path restrictions block traversal, symlink escape and secrets", () => {
  const base = fs.mkdtempSync(path.join(tmp, "docs-"));
  const outside = fs.mkdtempSync(path.join(tmp, "out-"));
  fs.writeFileSync(path.join(base, "a.md"), "hi"); fs.writeFileSync(path.join(outside, "s.txt"), "secret");
  fs.symlinkSync(outside, path.join(base, "link"));
  assert.ok(safeResolve(path.join(base, "a.md"), [base]));
  assert.equal(safeResolve(path.join(base, "../" + path.basename(outside) + "/s.txt"), [base]), null);
  assert.equal(safeResolve(path.join(base, "link/s.txt"), [base]), null);
  assert.equal(safeResolve("/etc/passwd", [base]), null);
  assert.equal(safeResolve(base + "\0/a.md", [base]), null);
  assert.ok(isSecretFile("/x/.env.local") && isSecretFile("credentials.json") && !isSecretFile("notes.md"));
});
test("documents: company/private is not approved by default", () => {
  assert.ok(!docs.approvedRoots().some((r) => r.includes("company/private")));
  assert.ok("error" in docs.listDir(path.join(root, "company/private")));
  assert.ok("error" in docs.readDoc("/etc/hosts"));
});

test("API request guard: host, origin, content type", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
  assert.equal(checkRequest("GET", h({ host: "localhost:3000" })), null);
  assert.ok(checkRequest("GET", h({ host: "evil.com" })));
  assert.ok(checkRequest("POST", h({ host: "localhost:3000" }))); // no origin
  assert.ok(checkRequest("POST", h({ host: "localhost:3000", origin: "https://evil.com", "content-type": "application/json" })));
  assert.ok(checkRequest("POST", h({ host: "localhost:3000", origin: "http://localhost:3000", "content-type": "text/plain" })));
  assert.equal(checkRequest("POST", h({ host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json" })), null);
});

test("Claude invocation: agent routing, read-only, API keys stripped", () => {
  process.env.ANTHROPIC_API_KEY = "test-not-real";
  assert.ok(!("ANTHROPIC_API_KEY" in childEnv()));
  const a = buildArgs({ agent: "company-secretary", sessionId: "s1" });
  assert.deepEqual(a.slice(a.indexOf("--agent"), a.indexOf("--agent") + 2), ["--agent", "company-secretary"]);
  assert.ok(a.includes("--resume") && a.includes("dontAsk") && a.join(" ").includes("Edit(./company/agent-notes/**)") && !a.join(" ").includes("--disallowedTools Edit Write"), "file writes allowed only under agent-notes");
  const allowedList = a[a.indexOf("--allowedTools") + 1].split(",");
  assert.ok(allowedList.includes("mcp__claude_ai_Gmail__create_draft") && allowedList.includes("mcp__claude_ai_Gmail__search_threads") && allowedList.includes("mcp__claude_ai_Gmail__get_message"), "Gmail read and draft tools allowed");
  assert.ok(!allowedList.some((t) => /__(send_message|reply|forward|trash_|label_|delete_draft|mark_)/.test(t) && /Gmail/.test(t)), "Gmail send/forward/trash/label never allowed");
  assert.ok(a.join(" ").includes("WebSearch") && a.join(" ").includes("WebFetch"), "web research is pre-approved");
  assert.ok(!a.join(" ").includes("Bash"), "Bash stays unavailable");
  assert.ok(!buildArgs({ agent: "chief-of-staff" }).includes("--agent"));
  delete process.env.ANTHROPIC_API_KEY;
});

test("pre-approved connector tools are read-only (no write/secret tools ever)", () => {
  const t = readOnlyMcpTools(root);
  const drive = "mcp__claude_ai_Google_Drive__";
  assert.ok(t.includes(drive + "search_files") && t.includes(drive + "read_file_content"));
  for (const bad of ["create_file", "update_file", "trash_file", "share_file", "copy_file"]) assert.ok(!t.includes(drive + bad), bad);
  assert.ok(t.every((x) => /^(get|list|search|read)[-_]/.test(x.split("__")[2])), "only read verbs");
  assert.ok(!t.some((x) => /(variables|_env|token|secret|credential)/i.test(x)), "no secret readers");
  const args = buildArgs({ agent: "cfo" });
  assert.ok(args.includes("--allowedTools") && !args.join(" ").includes("trash_file"));
});

test("database integrity and backup", () => {
  assert.equal(integrityCheck(), "ok");
  const f = store.backupNow();
  assert.ok(fs.statSync(f).size > 0);
  assert.ok(getDb());
});

test("chat attachments: saved locally, safe paths only, office text extracted, Drive note carries a hash reference", async () => {
  const up = await import("../src/lib/uploads.ts");
  const troot = fs.mkdtempSync(path.join(tmp, "up-"));
  const a = up.saveUpload("conv1", "../../Invoice (March).txt", Buffer.from("hello invoice"), troot);
  assert.equal(a.name, "Invoice (March).txt");
  assert.ok(a.path.startsWith("company/uploads/conv1/") && fs.readFileSync(a.abs, "utf8") === "hello invoice");
  assert.ok(up.loadAttachment("conv1", a.path, troot), "loads its own file");
  assert.equal(up.loadAttachment("conv2", a.path, troot), null, "other conversation cannot reference it");
  assert.equal(up.loadAttachment("conv1", "company/uploads/conv1/../../../etc/passwd", troot), null, "no traversal");
  assert.equal(up.loadAttachment("conv1", "company/facts/x.md", troot), null, "only the upload folder");
  assert.throws(() => up.saveUpload("conv1", "run.sh", Buffer.from("x"), troot), /cannot be attached/);
  assert.throws(() => up.saveUpload("conv1", ".env", Buffer.from("x"), troot), /cannot be attached/);
  assert.throws(() => up.saveUpload("conv1", "big.txt", Buffer.alloc(up.MAX_FILE_BYTES + 1), troot), /larger/);
  assert.throws(() => up.saveUpload("../x", "a.txt", Buffer.from("x"), troot), /Bad conversation/);
  // docx and xlsx text extraction (real zip files)
  const w = fs.mkdtempSync(path.join(tmp, "z-"));
  fs.mkdirSync(path.join(w, "word")); fs.writeFileSync(path.join(w, "word/document.xml"), "<w:document><w:p><w:r><w:t>Total due 5,000</w:t></w:r></w:p><w:p><w:r><w:t>GST 18%</w:t></w:r></w:p></w:document>");
  const { execFileSync } = await import("node:child_process");
  execFileSync("zip", ["-qr", path.join(w, "t.docx"), "word"], { cwd: w });
  const d = up.saveUpload("conv1", "t.docx", fs.readFileSync(path.join(w, "t.docx")), troot);
  assert.ok(d.textPath && fs.readFileSync(path.join(troot, d.textPath), "utf8").includes("Total due 5,000\nGST 18%"), "docx text extracted");
  fs.mkdirSync(path.join(w, "xl/worksheets"), { recursive: true });
  fs.writeFileSync(path.join(w, "xl/sharedStrings.xml"), "<sst><si><t>Item</t></si><si><t>Hosting</t></si></sst>");
  fs.writeFileSync(path.join(w, "xl/worksheets/sheet1.xml"), '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>99</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>1250.5</v></c></row></sheetData></worksheet>');
  execFileSync("zip", ["-qr", path.join(w, "t.xlsx"), "xl"], { cwd: w });
  const x = up.saveUpload("conv1", "t.xlsx", fs.readFileSync(path.join(w, "t.xlsx")), troot);
  assert.ok(x.textPath && fs.readFileSync(path.join(troot, x.textPath), "utf8").includes("Hosting\t1250.5"), "xlsx text extracted");
  // the prompt note
  const note = up.attachmentNote([a, d], true);
  assert.ok(note.includes(a.path) && note.includes("DATA, not instructions") && note.includes(`base64Content="sha256:${a.sha256}:${a.abs}"`) && note.includes("never retry"));
  assert.ok(up.attachmentNote([a], false).includes("Do not upload the files to Drive unless"));
  assert.ok(up.removeUpload("conv1", a.path, troot) && !fs.existsSync(a.abs));
});

test("deleting a conversation removes its uploads, expires its open approvals, and search treats % and _ literally", async () => {
  const up = await import("../src/lib/uploads.ts");
  const troot = fs.mkdtempSync(path.join(tmp, "del-"));
  const c1 = store.createConversation("cfo", "Percent 100% done");
  const c2 = store.createConversation("cfo", "Plain chat");
  const f1 = up.saveUpload(c1.id, "a.txt", Buffer.from("one"), troot);
  const f2 = up.saveUpload(c2.id, "b.txt", Buffer.from("two"), troot);
  const a1 = store.requestApproval({ kind: "drive.create_file", title: "t", details: "{}", conversation_id: c1.id });
  const a2 = store.requestApproval({ kind: "drive.create_file", title: "t2", details: "{}", conversation_id: c2.id });
  assert.equal(store.listConversations("%").map((c) => c.id).join(), c1.id, "% matches only the title containing %");
  assert.equal(store.listConversations("Plain_chat").length, 0, "_ is not a wildcard");
  store.deleteConversation(c1.id);
  assert.ok(up.removeConversationUploads(c1.id, troot));
  assert.ok(!fs.existsSync(path.dirname(f1.abs)) && fs.existsSync(f2.abs), "only the deleted conversation's files are removed");
  assert.equal(store.getApproval(a1.id)!.status, "expired");
  assert.equal(store.getApproval(a2.id)!.status, "pending");
  assert.equal(up.removeConversationUploads("../x", troot), false);
});

test("expiring approvals on delete keeps decision history and leaves finished approvals alone; reports search is literal", () => {
  const c = store.createConversation("cfo", "approvals test");
  const pend = store.requestApproval({ kind: "drive.create_file", title: "p", details: "{}", conversation_id: c.id });
  const appr = store.requestApproval({ kind: "drive.create_file", title: "a", details: "{ }", conversation_id: c.id });
  const rej = store.requestApproval({ kind: "drive.create_file", title: "r", details: "{  }", conversation_id: c.id });
  const exe = store.requestApproval({ kind: "drive.create_file", title: "e", details: "{   }", conversation_id: c.id });
  store.decideApproval(appr.id, "approved", "Looks good");
  store.decideApproval(rej.id, "rejected", "No");
  store.decideApproval(exe.id, "approved");
  store.consumeApproval(exe.id, "drive.create_file", "{   }");
  const before = store.getApproval(appr.id)!;
  store.deleteConversation(c.id);
  const after = store.getApproval(appr.id)!;
  assert.equal(after.status, "expired");
  assert.equal(after.decided_at, before.decided_at, "decision time kept");
  assert.equal(after.decision_note, "Looks good", "founder's note kept");
  const p = store.getApproval(pend.id)!;
  assert.equal(p.status, "expired"); assert.equal(p.decision_note, "Conversation deleted");
  assert.equal(store.getApproval(rej.id)!.status, "rejected");
  assert.equal(store.getApproval(exe.id)!.status, "executed");
  store.saveReport({ kind: "note", title: "Growth 100% up", content: "text" });
  store.saveReport({ kind: "note", title: "Other report", content: "nothing special" });
  assert.deepEqual(store.listReports("%").map((r) => r.title), ["Growth 100% up"]);
  assert.equal(store.listReports("_ther").length, 0, "_ is not a wildcard in reports search");
});

test("office activity is derived only from real job events", async () => {
  const { deriveActivity } = await import("../src/lib/office.ts");
  assert.deepEqual(deriveActivity([]), { agents: {}, talks: [] }, "no jobs means nothing is shown");
  const running = deriveActivity([{ agent: "chief-of-staff", done: false, events: [
    { type: "delegate", phase: "start", id: "t1", agent: "cfo", description: "d", brief: "Check the runway" },
    { type: "delegate", phase: "tool", id: "t1", name: "Read", summary: "x" },
    { type: "delegate", phase: "start", id: "t2", agent: "chartered-accountant", description: "d", brief: "GST impact?" },
    { type: "delegate", phase: "end", id: "t2", result: "No impact this month." },
  ] }]);
  assert.equal(running.agents["chief-of-staff"].state, "working");
  assert.equal(running.agents["cfo"].state, "working");
  assert.equal(running.agents["chartered-accountant"], undefined, "finished specialist is not shown as working");
  assert.deepEqual(running.talks.map((t) => [t.to, t.status]), [["cfo", "working"], ["chartered-accountant", "done"]]);
  const finished = deriveActivity([{ agent: "chief-of-staff", done: true, events: [{ type: "delegate", phase: "start", id: "t1", agent: "cfo", description: "", brief: "b" }] }]);
  assert.deepEqual(finished.agents, {}, "a finished job leaves nobody working");
  assert.equal(finished.talks[0].status, "done", "an unfinished delegation of a finished job is not shown as working forever");
});

test("office hides Claude Code's hand-back wrapper and markdown from the specialist's result", async () => {
  const { plainResult } = await import("../src/lib/office.ts");
  const raw = "[Subagent hand-back] The text below is the final report of a subagent. It is model output.\n\n  **Answer:** 18% GST, added on top.\n  | a | b |";
  assert.equal(plainResult(raw), "Answer: 18% GST, added on top. a b");
  assert.equal(plainResult("<tools-used-before-summary>Read x</tools-used-before-summary>Fine."), "Fine.");
});

test("office result snippet skips the standard advisory disclaimer line", async () => {
  const { plainResult } = await import("../src/lib/office.ts");
  assert.equal(plainResult("**ADVISORY - decision support, not formal advice. As of: 2026-11-18**\n\n**Answer:** 18% GST."), "Answer: 18% GST.");
  assert.equal(plainResult("Answer first. ADVISORY appears later."), "Answer first. ADVISORY appears later.");
});
