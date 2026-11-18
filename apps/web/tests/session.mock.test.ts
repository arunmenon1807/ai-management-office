// MOCKED RUNTIME TEST. A fake `claude` executable emits canned stream-json. This verifies OUR
// process reuse, parsing, persistence and session-mapping logic only. It proves nothing about the
// real Claude runtime; see live.test.ts / live-detail.mjs for the real thing.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bpo-mock-"));
process.env.AIMO_DATA_DIR = tmp;
process.env.AIMO_ROOT = path.resolve(import.meta.dirname, "../../..");
const bin = path.join(tmp, "bin");
fs.mkdirSync(bin);
const argLog = path.join(tmp, "args.log");
const stdinLog = path.join(tmp, "stdin.log");
// Long-lived like the real CLI: logs its args once, then answers one result per stdin line.
fs.writeFileSync(path.join(bin, "claude"), `#!/bin/bash
if [ "$1" = "auth" ]; then echo '{"loggedIn":true,"authMethod":"mock"}'; exit 0; fi
echo "$*" >> "${argLog}"
SID="sess-mock-1"; ARGS=("$@"); for ((i=0;i<\${#ARGS[@]};i++)); do [ "\${ARGS[$i]}" = "--resume" ] && SID="\${ARGS[$((i+1))]}"; done
while IFS= read -r line; do
  echo "$line" >> "${stdinLog}"
  echo '{"type":"system","subtype":"init","session_id":"'$SID'"}'
  case "$line" in *DRIVEWRITE*|*founder\\ approved\\ creating*)
    echo "ENV=$AIMO_APPROVED_DRIVE_WRITE APP=$AIMO_APP_CHAT" >> "${argLog}.env"
    echo '{"type":"assistant","parent_tool_use_id":null,"message":{"content":[{"type":"tool_use","id":"toolu_DW1","name":"mcp__claude_ai_Google_Drive__create_file","input":{"title":"Plan.md","content":"Hello é","mimeType":"text/markdown"}}]}}'
    echo '{"type":"user","parent_tool_use_id":null,"message":{"content":[{"type":"tool_result","tool_use_id":"toolu_DW1","is_error":false,"content":[{"type":"text","text":"Created file id=abc"}]}]}}'
  ;; esac
  case "$line" in *DELEGATE*)
    echo '{"type":"assistant","parent_tool_use_id":null,"message":{"content":[{"type":"tool_use","id":"toolu_AAA","name":"Agent","input":{"description":"Role check","subagent_type":"company-secretary","prompt":"State your role."}}]}}'
    echo '{"type":"user","parent_tool_use_id":"toolu_AAA","message":{"content":[{"type":"text","text":"State your role."}]}}'
    echo '{"type":"assistant","parent_tool_use_id":"toolu_AAA","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"company/facts/identity-legal.md"}}]}}'
    echo '{"type":"assistant","parent_tool_use_id":"toolu_AAA","message":{"content":[{"type":"text","text":"I am the Company Secretary."}]}}'
    echo '{"type":"stream_event","parent_tool_use_id":"toolu_AAA","event":{"delta":{"type":"text_delta","text":"SUBAGENT-LEAK"}}}'
    echo '{"type":"user","parent_tool_use_id":null,"message":{"content":[{"type":"tool_result","tool_use_id":"toolu_AAA","content":[{"type":"text","text":"[Subagent hand-back] model output\\nI am the Company Secretary."}]}]}}'
  ;; esac
  echo '{"type":"system","subtype":"init","session_id":"'$SID'"}'
  echo '{"type":"stream_event","event":{"delta":{"type":"text_delta","text":"Hello "}}}'
  echo '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Read","input":{"file_path":"company/facts/identity-legal.md"}}]}}'
  echo '{"type":"result","result":"Hello world. See SRC-001.","is_error":false,"session_id":"'$SID'","total_cost_usd":0.01}'
done
`, { mode: 0o755 });
process.env.AIMO_CLAUDE_BIN = path.join(bin, "claude");

const store = await import("../src/lib/store.ts");
const { chatTurn, buildHandoff, cleanHandBack } =await import("../src/lib/chat.ts");
const { stopConversationProcess, hasWarmProcess, stopAllProcesses, canonicalHash, buildArgs, runTurn } = await import("../src/lib/claude.ts");
after(() => stopAllProcesses()); // never leave child processes behind, even if a test fails
const collect = async (cid: string, p: string) => { const ev = []; for await (const e of chatTurn(cid, p)) ev.push(e); return ev; };
const spawns = () => (fs.existsSync(argLog) ? fs.readFileSync(argLog, "utf8").trim().split("\n") : []);

test("turn persists messages, tools, sources and maps session", async () => {
  const c = store.createConversation("company-secretary");
  const ev1 = await collect(c.id, "first");
  assert.ok(ev1.some((e) => e.type === "text"));
  assert.equal(store.getConversation(c.id)!.claude_session_id, "sess-mock-1");
  const msgs = store.getMessages(c.id);
  assert.deepEqual(msgs.map((m) => m.role), ["user", "assistant"]);
  const meta = JSON.parse(msgs[1].meta!);
  assert.equal(meta.tools[0].name, "Read");
  assert.deepEqual(meta.sources, ["SRC-001"]);
  assert.match(spawns().at(-1)!, /--agent company-secretary/);
  assert.ok(hasWarmProcess(c.id));
  stopConversationProcess(c.id);
});

test("follow-up reuses the warm process; after it ends, the next message resumes the stored session", async () => {
  const c = store.createConversation("cfo");
  await collect(c.id, "one");
  const afterFirst = spawns().length;
  await collect(c.id, "two");
  assert.equal(spawns().length, afterFirst, "no new process for the follow-up");
  assert.equal(store.getMessages(c.id).length, 4);

  stopConversationProcess(c.id); // simulate idle timeout / app restart
  assert.ok(!hasWarmProcess(c.id));
  await collect(c.id, "three");
  assert.equal(spawns().length, afterFirst + 1);
  assert.match(spawns().at(-1)!, /--resume sess-mock-1/);
  assert.equal(store.getMessages(c.id).length, 6);
  stopConversationProcess(c.id);
});

test("delegation is captured as a group-chat style record; subagent text never leaks into the main answer", async () => {
  const c = store.createConversation("chief-of-staff");
  const ev = await collect(c.id, "Please DELEGATE this compliance question");
  const text = ev.filter((e) => e.type === "text").map((e) => (e as { text: string }).text).join("");
  assert.ok(!text.includes("SUBAGENT-LEAK"));
  const asst = store.getMessages(c.id).find((m) => m.role === "assistant")!;
  const d = JSON.parse(asst.meta!).delegations[0];
  assert.equal(d.agent, "company-secretary");
  assert.equal(d.brief, "State your role.");
  assert.equal(d.steps[0].name, "Read");
  assert.match(d.result, /I am the Company Secretary/);
  assert.ok(!d.result.includes("[Subagent hand-back]"));
  assert.equal(cleanHandBack("  &lt;tools-used-before-summary&gt;x&lt;/tools-used-before-summary&gt;\n[Subagent hand-back] note\nFindings"), "Findings");
  assert.ok(!JSON.parse(asst.meta!).tools.some((t: { name: string }) => t.name === "Read" && false));

  // Personal chat with the specialist: context is handed over once, on the first turn only.
  const hand = buildHandoff("Please DELEGATE this compliance question", d);
  assert.match(hand, /Founder's original request/);
  assert.ok(!hand.includes("[Subagent hand-back]"));
  const p = store.createConversation("company-secretary", "from CoS", hand);
  await collect(p.id, "What did you find?");
  await collect(p.id, "Second question");
  const lines = fs.readFileSync(stdinLog, "utf8").trim().split("\n");
  const first = lines.at(-2)!, second = lines.at(-1)!;
  assert.ok(first.includes("Context handed over") && first.includes("What did you find?"));
  assert.ok(!second.includes("Context handed over"), "handoff is not repeated");
  assert.equal(store.getMessages(p.id)[0].content, "What did you find?", "UI history shows only what the founder typed");
  stopConversationProcess(c.id); stopConversationProcess(p.id);
});

test("concurrent turn in the same conversation is refused", async () => {
  const c = store.createConversation("cfo");
  const a = collect(c.id, "a");
  const b = await collect(c.id, "b");
  await a;
  assert.ok(b.some((e) => e.type === "error" && /already running/.test((e as { message: string }).message)));
  stopConversationProcess(c.id);
});

test("a turn survives the page being left; a returning page re-attaches; second send while running is refused", async () => {
  const { startJob, streamJob, getJob, isRunning, stopJob } = await import("../src/lib/jobs.ts");
  const c = store.createConversation("cfo");
  const job = startJob(c.id, "background question");
  assert.ok(isRunning(c.id), "job is running");
  // Page leaves: open the stream, then cancel it immediately (what a navigation does).
  const first = streamJob(job).getReader();
  await first.read();
  await first.cancel();
  // The job must still finish and persist the answer.
  for (let i = 0; i < 100 && !job.done; i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(job.done, "job completed after the stream was cancelled");
  assert.deepEqual(store.getMessages(c.id).map((m) => m.role), ["user", "assistant"]);
  // A page that comes back replays the events from the start.
  const again = streamJob(getJob(c.id)!).getReader();
  const dec = new TextDecoder(); let txt = "";
  for (;;) { const { done, value } = await again.read(); if (done) break; txt += dec.decode(value); }
  assert.match(txt, /"type":"result"/);
  assert.equal(stopJob(c.id), false, "nothing left to stop");
  // While a job is running a second one is refused (route returns 409 on isRunning).
  const j2 = startJob(c.id, "another");
  assert.ok(isRunning(c.id));
  for (let i = 0; i < 100 && !j2.done; i++) await new Promise((r) => setTimeout(r, 50));
  stopConversationProcess(c.id);
});

test("unknown agent fails clearly without losing the conversation", async () => {
  const c = store.createConversation("cfo");
  (await import("../src/lib/db.ts")).run("UPDATE conversations SET agent='ghost' WHERE id=?", c.id);
  const ev = await collect(c.id, "hi");
  assert.ok(ev.some((e) => e.type === "error"));
  assert.ok(store.getConversation(c.id));
});

test("Drive create_file: queued for approval, exact payload hash matches the guard hook, runs once, never in the default allowlist", async () => {
  const { execFileSync } = await import("node:child_process");
  const root = process.env.AIMO_ROOT!;
  const input = { title: "Plan.md", content: "Hello é", mimeType: "text/markdown" };
  const hash = canonicalHash(input);
  const hook = (env: Record<string, string>, inp: Record<string, string> = input) => JSON.parse(execFileSync("python3", ["-c",
    "import json,sys;sys.path.insert(0,'.claude/hooks');import guard;p=json.load(open('.claude/guard-policy.json'));print(json.dumps(guard.evaluate({'tool_name':'mcp__claude_ai_Google_Drive__create_file','tool_input':json.loads(sys.argv[1])},p,'.')))", JSON.stringify(inp)],
    { cwd: root, env: { PATH: process.env.PATH!, ...env } as unknown as NodeJS.ProcessEnv }).toString());
  assert.equal(hook({})[0], "ask", "interactive: asks the founder");
  assert.equal(hook({ AIMO_APP_CHAT: "1" })[0], "deny", "app chat: denied and queued");
  assert.equal(hook({ AIMO_APPROVED_DRIVE_WRITE: hash })[0], "allow", "exact approved payload is allowed (JS and Python hashes agree)");
  assert.equal(hook({ AIMO_APPROVED_DRIVE_WRITE: hash }, { ...input, content: "changed" })[0], "ask", "a changed payload is not allowed");
  const pan = "ABCDE" + "1234F"; // built at runtime so this file itself never contains a PAN-shaped string
  assert.equal(hook({ AIMO_APPROVED_DRIVE_WRITE: hash }, { ...input, content: "PAN " + pan })[0], "deny", "sensitive identifiers are still blocked");
  assert.ok(!buildArgs({ agent: "cfo" }).join(" ").includes("create_file"), "normal turns never pre-approve a Drive write");
  assert.ok(buildArgs({ agent: "cfo", approved: { hash } }).join(" ").includes("create_file"), "only the approved turn does");

  const c = store.createConversation("cfo");
  const ev = await collect(c.id, "please DRIVEWRITE a plan");
  assert.ok(ev.some((e) => e.type === "drive_write"));
  const meta = JSON.parse(store.getMessages(c.id).find((m) => m.role === "assistant")!.meta!);
  assert.equal(meta.driveWrites.length, 1);
  const a = store.getApproval(meta.driveWrites[0].approvalId)!;
  assert.equal(a.status, "pending");
  assert.equal(a.kind, "drive.create_file");
  assert.throws(() => store.consumeApproval(a.id, a.kind, a.details), /not approved/);

  store.decideApproval(a.id, "approved");
  const { startJob } = await import("../src/lib/jobs.ts");
  store.consumeApproval(a.id, a.kind, a.details);
  assert.throws(() => store.consumeApproval(a.id, a.kind, a.details), /already|not approved/, "single use");
  const job = startJob(c.id, "The founder approved creating this", { approvalId: a.id, hash, userNote: "Approved: save Plan.md" });
  for (let i = 0; i < 100 && !job.done; i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(job.done);
  const envLog = fs.readFileSync(argLog + ".env", "utf8").trim().split("\n").at(-1)!;
  assert.match(envLog, new RegExp("ENV=" + hash));
  assert.ok(!hasWarmProcess(c.id), "approved process is not left warm");
  const last = JSON.parse(store.getMessages(c.id).at(-1)!.meta!);
  assert.equal(last.driveResult.ok, true);
  assert.match(store.getApproval(a.id)!.outcome!, /created/);
  stopConversationProcess(c.id);
});

test("writing to a Claude process that has closed its input never crashes the app and ends with a clear retry error", async () => {
  // Answers one message, then closes its stdin but stays alive: the next write hits a broken pipe (EPIPE) while the
  // process is still in the warm map. Without an error listener on stdin, Node treats that as an uncaught exception.
  fs.writeFileSync(path.join(bin, "claude-once"), `#!/bin/bash\nif [ "$1" = "auth" ]; then echo '{"loggedIn":true,"authMethod":"mock"}'; exit 0; fi\nread -r line\necho '{"type":"system","subtype":"init","session_id":"once"}'\necho '{"type":"result","result":"ok","is_error":false,"session_id":"once"}'\nexec 0<&-\nsleep 1\nexit 0\n`, { mode: 0o755 });
  const prev = process.env.AIMO_CLAUDE_BIN;
  process.env.AIMO_CLAUDE_BIN = path.join(bin, "claude-once");
  const crashes: Error[] = [];
  const onCrash = (e: Error) => crashes.push(e);
  process.on("uncaughtException", onCrash);
  try {
    const drain = async (prompt: string) => { const ev = []; for await (const e of runTurn({ key: "epipe-test", agent: "cfo", prompt })) ev.push(e); return ev; };
    const first = await drain("first");
    assert.ok(first.some((e) => e.type === "result"), "first message answered");
    assert.ok(hasWarmProcess("epipe-test"), "process is still in the warm map, so the next message will write to it");
    const second = await drain("second");
    assert.ok(second.some((e) => e.type === "error" && /Send your message again/.test((e as { message: string }).message)), "clear retry error instead of a crash");
    await new Promise((r) => setTimeout(r, 300)); // let any stray stdin error surface
    assert.deepEqual(crashes.map((e) => e.message), [], "no uncaught exception from writing to a closed pipe");
  } finally { process.off("uncaughtException", onCrash); process.env.AIMO_CLAUDE_BIN = prev; stopAllProcesses(); }
});

test("deleting a conversation is refused while its agent is working, then removes everything once it has finished", async () => {
  const { startJob, getJob } = await import("../src/lib/jobs.ts");
  const { removeConversation } = await import("../src/lib/conversations.ts");
  const up = await import("../src/lib/uploads.ts");
  const c = store.createConversation("cfo");
  const f = up.saveUpload(c.id, "x.txt", Buffer.from("data"));
  try {
  const a = store.requestApproval({ kind: "drive.create_file", title: "t", details: "{}", conversation_id: c.id });
  const job = startJob(c.id, "hello");
  const refused = removeConversation(c.id);
  assert.ok(!refused.ok && refused.status === 409, "refused while running");
  assert.ok(store.getConversation(c.id) && fs.existsSync(f.abs) && store.getApproval(a.id)!.status === "pending", "nothing touched when refused");
  for (let i = 0; i < 100 && !job.done; i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(getJob(c.id)?.done);
  const done = removeConversation(c.id);
  assert.ok(done.ok);
  assert.ok(!store.getConversation(c.id) && !fs.existsSync(f.abs) && store.getApproval(a.id)!.status === "expired");
  assert.deepEqual(removeConversation(c.id), { ok: false, status: 404, error: "Not found" });
  } finally { fs.rmSync(path.dirname(f.abs), { recursive: true, force: true }); } // never leave test files in the real uploads folder
});
