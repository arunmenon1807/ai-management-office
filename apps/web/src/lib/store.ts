import { all, one, run, id, now, audit, getDb } from "./db.ts";
import { sha256 } from "./security.ts";
import fs from "node:fs";
import path from "node:path";
import { backupDir } from "./paths.ts";

/* ---------- conversations ---------- */
export type Conversation = { id: string; agent: string; title: string; claude_session_id: string | null; created_at: string; updated_at: string; handoff: string | null };
export type Message = { id: string; conversation_id: string; role: "user" | "assistant" | "system"; content: string; meta: string | null; created_at: string };

export function createConversation(agent: string, title = "New conversation", handoff: string | null = null): Conversation {
  const c: Conversation = { id: id(), agent, title, claude_session_id: null, created_at: now(), updated_at: now(), handoff };
  run("INSERT INTO conversations(id,agent,title,claude_session_id,created_at,updated_at,handoff) VALUES(?,?,?,?,?,?,?)", c.id, c.agent, c.title, null, c.created_at, c.updated_at, handoff);
  audit("conversation.create", { id: c.id, agent });
  return c;
}
/** Escape LIKE wildcards so a search for "%" or "_" matches those characters literally. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, "\\$&");
export const listConversations = (q?: string) =>
  q
    ? all<Conversation>(
        `SELECT DISTINCT c.* FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id
         WHERE c.title LIKE ? ESCAPE '\\' OR m.content LIKE ? ESCAPE '\\' ORDER BY c.updated_at DESC`, `%${likeEscape(q)}%`, `%${likeEscape(q)}%`)
    : all<Conversation>("SELECT * FROM conversations ORDER BY updated_at DESC");
export const getConversation = (cid: string) => one<Conversation>("SELECT * FROM conversations WHERE id=?", cid);
export const getMessages = (cid: string) => all<Message>("SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at, rowid", cid);
export function addMessage(cid: string, role: Message["role"], content: string, meta?: unknown): Message {
  const m = { id: id(), conversation_id: cid, role, content, meta: meta ? JSON.stringify(meta) : null, created_at: now() };
  run("INSERT INTO messages VALUES(?,?,?,?,?,?)", m.id, cid, role, content, m.meta, m.created_at);
  run("UPDATE conversations SET updated_at=? WHERE id=?", now(), cid);
  return m;
}
export function renameConversation(cid: string, title: string) {
  run("UPDATE conversations SET title=?, updated_at=? WHERE id=?", title.slice(0, 120), now(), cid);
  audit("conversation.rename", { id: cid });
}
export function setSession(cid: string, sessionId: string | null) {
  run("UPDATE conversations SET claude_session_id=? WHERE id=?", sessionId, cid);
}
export function deleteConversation(cid: string) {
  // Approvals have no foreign key: retire the open ones so they cannot linger as pending for a chat that is gone.
  run("UPDATE approvals SET status='expired', decided_at=COALESCE(decided_at, ?), decision_note=CASE WHEN COALESCE(decision_note,'')='' THEN 'Conversation deleted' ELSE decision_note END WHERE conversation_id=? AND status IN ('pending','approved')", now(), cid);
  run("DELETE FROM conversations WHERE id=?", cid);
  audit("conversation.delete", { id: cid });
}

/* ---------- tasks ---------- */
export const TASK_STATUSES = ["proposed", "approved", "in_progress", "blocked", "completed", "cancelled"] as const;
export const PRIORITIES = ["low", "medium", "high"] as const;
export type Task = {
  id: string; title: string; description: string; priority: string; status: string; due_date: string | null; owner: string | null;
  agent: string | null; conversation_id: string | null; report_id: string | null; created_at: string; completed_at: string | null;
};
export type TaskInput = Partial<Pick<Task, "title" | "description" | "priority" | "status" | "due_date" | "owner" | "agent" | "conversation_id" | "report_id">>;

export function validateTask(i: TaskInput, partial = false): string | null {
  if (!partial && !i.title?.trim()) return "Title is required";
  if (i.title !== undefined && (!i.title.trim() || i.title.length > 200)) return "Title must be 1-200 characters";
  if (i.priority !== undefined && !PRIORITIES.includes(i.priority as never)) return "Invalid priority";
  if (i.status !== undefined && !TASK_STATUSES.includes(i.status as never)) return "Invalid status";
  if (i.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(i.due_date)) return "Due date must be YYYY-MM-DD";
  return null;
}
export function createTask(i: TaskInput): Task {
  const t = { id: id(), title: i.title!.trim(), description: i.description ?? "", priority: i.priority ?? "medium", status: i.status ?? "proposed",
    due_date: i.due_date || null, owner: i.owner || null, agent: i.agent || null, conversation_id: i.conversation_id || null, report_id: i.report_id || null,
    created_at: now(), completed_at: null as string | null };
  run("INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", t.id, t.title, t.description, t.priority, t.status, t.due_date, t.owner, t.agent, t.conversation_id, t.report_id, t.created_at, t.completed_at);
  audit("task.create", { id: t.id });
  return t;
}
export function updateTask(tid: string, i: TaskInput): Task | undefined {
  const cur = one<Task>("SELECT * FROM tasks WHERE id=?", tid);
  if (!cur) return undefined;
  const n = { ...cur, ...Object.fromEntries(Object.entries(i).filter(([, v]) => v !== undefined)) } as Task;
  n.completed_at = n.status === "completed" ? cur.completed_at ?? now() : null;
  run("UPDATE tasks SET title=?,description=?,priority=?,status=?,due_date=?,owner=?,agent=?,conversation_id=?,report_id=?,completed_at=? WHERE id=?",
    n.title, n.description, n.priority, n.status, n.due_date || null, n.owner || null, n.agent, n.conversation_id, n.report_id, n.completed_at, tid);
  audit("task.update", { id: tid, status: n.status });
  return n;
}
export const listTasks = () => all<Task>("SELECT * FROM tasks ORDER BY CASE status WHEN 'completed' THEN 1 WHEN 'cancelled' THEN 1 ELSE 0 END, COALESCE(due_date,'9999'), created_at DESC");

/* ---------- reports (versioned) ---------- */
export type Report = { id: string; kind: string; title: string; agent: string | null; conversation_id: string | null; created_at: string };
export type ReportVersion = { id: string; report_id: string; version: number; content: string; sources: string | null; as_of: string | null; created_at: string };

export function saveReport(i: { kind: string; title: string; content: string; agent?: string; conversation_id?: string; sources?: string[]; as_of?: string; report_id?: string }) {
  let rid = i.report_id;
  if (rid && !one("SELECT 1 FROM reports WHERE id=?", rid)) throw new Error("Unknown report");
  if (!rid) {
    rid = id();
    run("INSERT INTO reports VALUES(?,?,?,?,?,?)", rid, i.kind, i.title, i.agent ?? null, i.conversation_id ?? null, now());
  }
  const v = (one<{ v: number | null }>("SELECT MAX(version) v FROM report_versions WHERE report_id=?", rid)?.v ?? 0) + 1;
  run("INSERT INTO report_versions VALUES(?,?,?,?,?,?,?)", id(), rid, v, i.content, JSON.stringify(i.sources ?? []), i.as_of ?? now().slice(0, 10), now());
  audit("report.save", { id: rid, version: v });
  return { id: rid, version: v };
}
export const listReports = (q?: string, kind?: string) =>
  all<Report & { versions: number; latest: string }>(
    `SELECT r.*, (SELECT COUNT(*) FROM report_versions v WHERE v.report_id=r.id) versions,
       (SELECT MAX(created_at) FROM report_versions v WHERE v.report_id=r.id) latest
     FROM reports r WHERE (?1 IS NULL OR r.title LIKE '%'||?1||'%' ESCAPE '\\' OR EXISTS(SELECT 1 FROM report_versions v WHERE v.report_id=r.id AND v.content LIKE '%'||?1||'%' ESCAPE '\\'))
       AND (?2 IS NULL OR r.kind=?2) ORDER BY latest DESC`, q ? likeEscape(q) : null, kind || null);
export const getReport = (rid: string) => one<Report>("SELECT * FROM reports WHERE id=?", rid);
export const getReportVersions = (rid: string) => all<ReportVersion>("SELECT * FROM report_versions WHERE report_id=? ORDER BY version DESC", rid);

/* ---------- approvals ----------
 * An approval authorises exactly ONE execution of exactly the recorded payload.
 * Any executor MUST call consumeApproval(id, payload) immediately before acting; it
 * verifies status, the payload hash and single use. No external executor exists in v0.1. */
export type Approval = {
  id: string; kind: string; title: string; details: string; payload_hash: string; agent: string | null; conversation_id: string | null;
  status: string; requested_at: string; decided_at: string | null; decision_note: string | null; consumed_at: string | null; outcome: string | null;
};
export function requestApproval(i: { kind: string; title: string; details: string; agent?: string; conversation_id?: string }): Approval {
  if (!i.title?.trim() || !i.details?.trim() || !i.kind?.trim()) throw new Error("kind, title and details are required");
  const a = { id: id(), kind: i.kind, title: i.title.trim(), details: i.details, payload_hash: sha256(i.kind + "\n" + i.details), agent: i.agent ?? null, conversation_id: i.conversation_id ?? null, requested_at: now() };
  run("INSERT INTO approvals(id,kind,title,details,payload_hash,agent,conversation_id,status,requested_at) VALUES(?,?,?,?,?,?,?,'pending',?)", a.id, a.kind, a.title, a.details, a.payload_hash, a.agent, a.conversation_id, a.requested_at);
  audit("approval.request", { id: a.id, kind: a.kind });
  return one<Approval>("SELECT * FROM approvals WHERE id=?", a.id)!;
}
export function decideApproval(aid: string, decision: "approved" | "rejected", note = "") {
  const r = run("UPDATE approvals SET status=?, decided_at=?, decision_note=? WHERE id=? AND status='pending'", decision, now(), note, aid);
  if (!r.changes) throw new Error("Approval is not pending");
  audit("approval.decide", { id: aid, decision });
}
export function consumeApproval(aid: string, kind: string, details: string): void {
  const a = one<Approval>("SELECT * FROM approvals WHERE id=?", aid);
  if (!a) throw new Error("Unknown approval");
  if (a.status !== "approved") throw new Error(`Approval is ${a.status}, not approved`);
  if (a.payload_hash !== sha256(kind + "\n" + details)) throw new Error("Payload differs from what was approved");
  const r = run("UPDATE approvals SET status='executed', consumed_at=? WHERE id=? AND status='approved' AND consumed_at IS NULL", now(), aid);
  if (!r.changes) throw new Error("Approval already used");
  audit("approval.consume", { id: aid });
}
export function setApprovalOutcome(aid: string, outcome: string) { run("UPDATE approvals SET outcome=? WHERE id=?", outcome.slice(0, 2000), aid); }
export const getApproval = (aid: string) => one<Approval>("SELECT * FROM approvals WHERE id=?", aid);
export const listApprovals = () => all<Approval>("SELECT * FROM approvals ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, requested_at DESC");

/* ---------- settings / backups ---------- */
export const getSetting = (k: string, d = "") => one<{ value: string }>("SELECT value FROM settings WHERE key=?", k)?.value ?? d;
export const setSetting = (k: string, v: string) => { run("INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", k, v); };

export function backupNow(): string {
  const f = path.join(backupDir(), `office-${now().replace(/[:.]/g, "-")}.db`);
  getDb().exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
  fs.chmodSync(f, 0o600);
  audit("backup.create", { file: path.basename(f) });
  return f;
}
