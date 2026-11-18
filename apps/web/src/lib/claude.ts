import { spawn, execFile, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./paths.ts";
import { readOnlyMcpTools } from "./agents.ts";

/**
 * Runs the OFFICIAL `claude` CLI (headless, stream-json) from the repo root, so CLAUDE.md,
 * .claude/agents, skills, settings and the guard hook all apply unchanged. Auth is whatever the
 * user logged into the CLI with (their own subscription). API-key variables are REMOVED from the
 * child environment so a paid API key can never be used silently.
 *
 * One long-lived process per conversation keeps the agent "warm" and its context in memory, so
 * follow-up messages do not restart it. If that process ends (idle timeout, crash, app restart),
 * the next message starts a new process with `--resume <session id>`.
 */
const BLOCKED_ENV = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY"];
const IDLE_MS = 20 * 60 * 1000;

/** Finds the official `claude` CLI even when the app was started with a minimal PATH (Dock launch). */
export function claudeBin(): string {
  const override = process["env"].AIMO_CLAUDE_BIN;
  if (override) return override;
  for (const p of [path.join(os.homedir(), ".local/bin/claude"), path.join(os.homedir(), ".claude/local/claude"), "/opt/homebrew/bin/claude", "/usr/local/bin/claude"]) {
    if (fs.existsSync(p)) return p;
  }
  return "claude";
}

export function childEnv(): NodeJS.ProcessEnv {
  const e: NodeJS.ProcessEnv = { ...process["env"] };
  for (const k of BLOCKED_ENV) delete e[k];
  // Delegated specialists must finish inside the turn so the founder sees their answer in the same chat.
  e.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS = "1";
  return e;
}

export type AuthStatus = {
  cliFound: boolean;
  loggedIn: boolean;
  authMethod: string;
  apiKeyInEnvironment: boolean; // detected but deliberately ignored
  detail: string;
};

export function authStatus(): Promise<AuthStatus> {
  const apiKeyInEnvironment = !!(process["env"].ANTHROPIC_API_KEY || process["env"].ANTHROPIC_AUTH_TOKEN);
  return new Promise((resolve) => {
    execFile(claudeBin(), ["auth", "status"], { env: childEnv(), timeout: 15000 }, (err, stdout) => {
      if (err && !stdout) {
        return resolve({ cliFound: false, loggedIn: false, authMethod: "unknown", apiKeyInEnvironment, detail: "Claude Code CLI not found or not runnable." });
      }
      try {
        const j = JSON.parse(stdout);
        resolve({
          cliFound: true,
          loggedIn: !!j.loggedIn,
          authMethod: String(j.authMethod ?? "none"),
          apiKeyInEnvironment,
          detail: j.loggedIn ? "Signed in to Claude Code." : "Claude Code is not signed in. Run `claude auth login` in Terminal once.",
        });
      } catch {
        resolve({ cliFound: true, loggedIn: false, authMethod: "unknown", apiKeyInEnvironment, detail: "Could not read auth status." });
      }
    });
  });
}

export type RunEvent =
  | { type: "session"; sessionId: string }
  | { type: "text"; text: string }
  | { type: "tool"; name: string; summary: string }
  | { type: "delegate"; phase: "start"; id: string; agent: string; description: string; brief: string }
  | { type: "delegate"; phase: "tool"; id: string; name: string; summary: string }
  | { type: "delegate"; phase: "text"; id: string; text: string }
  | { type: "delegate"; phase: "end"; id: string; result: string }
  | { type: "result"; text: string; isError: boolean; sessionId?: string; costUsd?: number; durationMs?: number; denials: string[] }
  | { type: "drive_write"; tool: string; id: string; input: Record<string, unknown> }
  | { type: "drive_result"; id: string; ok: boolean; text: string }
  | { type: "error"; message: string };

/** A single founder-approved Drive file creation: the exact tool input, bound by hash to the guard hook. */
export type ApprovedWrite = { hash: string };
const DRIVE_CREATE = /^mcp__claude_ai_Google_Drive__create_file$/;
export const isDriveCreate = (name: string) => DRIVE_CREATE.test(name);
const DRIVE_CREATE_TOOLS = ["mcp__claude_ai_Google_Drive__create_file"];
/** Gmail drafts live in the founder's mailbox and are never sent by agents; the guard hook scans their content. */
export const MAIL_DRAFT_TOOLS = ["create_draft", "update_draft"].flatMap((n) => [`mcp__claude_ai_Gmail__${n}`]);
const sortKeys =(v: any): any => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
/** Same canonical form as .claude/hooks/guard.py (sorted keys, compact separators, no ASCII escaping). */
export const canonicalHash = (input: unknown) => createHash("sha256").update(JSON.stringify(sortKeys(input))).digest("hex");

export function buildArgs(opts: { agent: string; sessionId?: string | null; approved?: ApprovedWrite }): string[] {
  const a = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--forward-subagent-text", "--permission-mode", "dontAsk"];
  if (opts.agent !== "chief-of-staff") a.push("--agent", opts.agent);
  // Chat is read-only for files, with one exception: an agent may write its own notes file. In dontAsk mode
  // anything not explicitly allowed is denied, so Edit rules cover Write too, and work ONLY under company/agent-notes/.
  a.push("--disallowedTools", "NotebookEdit");
  // Pre-approve read-only connector tools (e.g. Google Drive search/read). Without this, dontAsk mode denies them.
  const allowed = ["WebSearch", "WebFetch", "Edit(./company/agent-notes/**)", ...readOnlyMcpTools(), ...MAIL_DRAFT_TOOLS, ...(opts.approved ? DRIVE_CREATE_TOOLS : [])];
  if (allowed.length) a.push("--allowedTools", allowed.join(","));
  if (opts.sessionId) a.push("--resume", opts.sessionId);
  return a;
}

function summarizeTool(name: string, input: Record<string, unknown>): string {
  const v = (input.file_path ?? input.pattern ?? input.query ?? input.url ?? input.description ?? input.subagent_type ?? input.command ?? "") as string;
  return String(v).slice(0, 140);
}

/* ---------- long-lived per-conversation processes ---------- */
type Proc = {
  child: ChildProcessWithoutNullStreams;
  lines: string[];
  wake: (() => void) | null;
  exited: boolean;
  code: number | null;
  stderr: string;
  idle: NodeJS.Timeout;
};
const procs = new Map<string, Proc>();

function startProc(key: string, agent: string, sessionId?: string | null, approved?: ApprovedWrite): Proc {
  const env = { ...childEnv(), AIMO_APP_CHAT: "1", ...(approved ? { AIMO_APPROVED_DRIVE_WRITE: approved.hash } : {}) };
  const child = spawn(claudeBin(), buildArgs({ agent, sessionId, approved }), { cwd: repoRoot(), env, stdio: ["pipe", "pipe", "pipe"] });
  const p: Proc = { child, lines: [], wake: null, exited: false, code: null, stderr: "", idle: setTimeout(() => stopConversationProcess(key), IDLE_MS) };
  p.idle.unref?.();
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) p.lines.push(line);
    }
    p.wake?.();
  });
  child.stderr.on("data", (d) => (p.stderr += d.toString()));
  child.on("error", (e) => { p.stderr += String(e.message); });
  // Writing to a process that has just exited emits an error on stdin; without a listener Node would treat it as fatal.
  // The turn then ends through the "close" handler with the normal "send your message again" error.
  child.stdin.on("error", (e) => { p.stderr += String(e.message); });
  child.on("close", (code) => {
    p.exited = true; p.code = code; clearTimeout(p.idle);
    if (procs.get(key) === p) procs.delete(key);
    p.wake?.();
  });
  procs.set(key, p);
  return p;
}

/** Ends the warm process for a conversation (rename/delete/tests). The next message resumes from the stored session id. */
export function stopConversationProcess(key: string) {
  const p = procs.get(key);
  if (!p) return;
  procs.delete(key);
  clearTimeout(p.idle);
  try { p.child.stdin.end(); } catch { /* ignore */ }
  setTimeout(() => p.child.kill("SIGTERM"), 2000).unref?.();
}
export function stopAllProcesses() {
  for (const k of [...procs.keys()]) stopConversationProcess(k);
}
export const hasWarmProcess =(key: string) => procs.has(key);

/** Streams events for one turn of conversation `key`. Reuses the warm process when there is one. */
export async function* runTurn(opts: { key: string; agent: string; sessionId?: string | null; prompt: string; signal?: AbortSignal; approved?: ApprovedWrite }): AsyncGenerator<RunEvent> {
  // An approved write runs in its own short-lived process so the permission never lingers in a warm one.
  if (opts.approved) stopConversationProcess(opts.key);
  const p = procs.get(opts.key) ?? startProc(opts.key, opts.agent, opts.sessionId, opts.approved);
  clearTimeout(p.idle);
  p.idle = setTimeout(() => stopConversationProcess(opts.key), IDLE_MS);
  p.idle.unref?.();
  const abort = () => { procs.delete(opts.key); p.child.kill("SIGINT"); setTimeout(() => p.child.kill("SIGTERM"), 3000).unref?.(); };
  opts.signal?.addEventListener("abort", abort);

  p.child.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: opts.prompt }] } }) + "\n");

  const denials: string[] = [];
  const driveIds = new Set<string>();
  let gotResult = false;
  try {
    while (!gotResult) {
      if (!p.lines.length) {
        if (p.exited) break;
        await new Promise<void>((r) => { p.wake = r; });
        p.wake = null;
        continue;
      }
      const line = p.lines.shift()!;
      let ev: any;
      try { ev = JSON.parse(line); } catch { continue; }
      const parent: string | null = ev.parent_tool_use_id ?? null;
      if (ev.type === "system" && ev.subtype === "init" && ev.session_id) yield { type: "session", sessionId: ev.session_id };
      else if (ev.type === "system" && ev.subtype === "permission_denied") denials.push(String(ev.tool_name ?? ev.message ?? "tool"));
      else if (ev.type === "stream_event" && !parent && ev.event?.delta?.type === "text_delta") yield { type: "text", text: ev.event.delta.text };
      else if (ev.type === "assistant" && Array.isArray(ev.message?.content)) {
        for (const b of ev.message.content) {
          if (b.type === "tool_use" && isDriveCreate(String(b.name)) && b.id) { driveIds.add(b.id); yield { type: "drive_write", tool: b.name, id: b.id, input: b.input ?? {} }; }
          if (parent) {
            // A specialist working for the Chief of Staff: surface its tool calls and text under its delegation.
            if (b.type === "tool_use") yield { type: "delegate", phase: "tool", id: parent, name: b.name, summary: summarizeTool(b.name, b.input ?? {}) };
            else if (b.type === "text" && b.text) yield { type: "delegate", phase: "text", id: parent, text: String(b.text) };
          } else if (b.type === "tool_use" && (b.name === "Agent" || b.name === "Task")) {
            yield { type: "delegate", phase: "start", id: b.id, agent: String(b.input?.subagent_type ?? "agent"), description: String(b.input?.description ?? ""), brief: String(b.input?.prompt ?? "") };
          } else if (b.type === "tool_use") yield { type: "tool", name: b.name, summary: summarizeTool(b.name, b.input ?? {}) };
        }
      } else if (ev.type === "user" && driveIds.size && Array.isArray(ev.message?.content) && ev.message.content.some((b: any) => b.type === "tool_result" && driveIds.has(b.tool_use_id))) {
        for (const b of ev.message.content) {
          if (b.type === "tool_result" && driveIds.has(b.tool_use_id)) {
            const txt = Array.isArray(b.content) ? b.content.map((x: any) => x.text ?? "").join("\n") : String(b.content ?? "");
            yield { type: "drive_result", id: b.tool_use_id, ok: !b.is_error, text: txt.slice(0, 1000) };
          }
        }
      } else if (ev.type === "user" && !parent && Array.isArray(ev.message?.content)) {
        for (const b of ev.message.content) {
          if (b.type === "tool_result" && b.tool_use_id) {
            const txt = Array.isArray(b.content) ? b.content.map((x: any) => x.text ?? "").join("\n") : String(b.content ?? "");
            yield { type: "delegate", phase: "end", id: b.tool_use_id, result: txt };
          }
        }
      } else if (ev.type === "result") {
        gotResult = true;
        yield {
          type: "result", text: String(ev.result ?? ""), isError: !!ev.is_error, sessionId: ev.session_id,
          costUsd: ev.total_cost_usd, durationMs: ev.duration_ms, denials: (ev.permission_denials ?? []).map((d: any) => d.tool_name ?? String(d)).concat(denials),
        };
      }
    }
    if (!gotResult) {
      procs.delete(opts.key);
      yield { type: "error", message: `Claude Code stopped (code ${p.code}) without a result. ${p.stderr.trim().slice(0, 400)} Send your message again to resume this conversation.`.trim() };
    }
  } finally {
    opts.signal?.removeEventListener("abort", abort);
    if (opts.approved) stopConversationProcess(opts.key);
  }
}
