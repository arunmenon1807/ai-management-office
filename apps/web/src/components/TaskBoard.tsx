"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Task = { id: string; title: string; description: string; priority: string; status: string; due_date: string | null; owner: string | null; agent: string | null; created_at: string; completed_at: string | null };
const STATUSES = ["proposed", "approved", "in_progress", "blocked", "completed", "cancelled"];

async function call(url: string, method: string, data: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
}

export default function TaskBoard({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [f, setF] = useState({ title: "", description: "", priority: "medium", due_date: "", owner: "" });
  const [err, setErr] = useState("");
  const wrap = async (fn: () => Promise<void>) => { try { setErr(""); await fn(); router.refresh(); } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="space-y-6">
      <form className="card p-4 grid gap-2 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); wrap(async () => { await call("/api/tasks", "POST", { ...f, status: "approved" }); setF({ ...f, title: "", description: "" }); }); }}>
        <input className="input md:col-span-2" placeholder="New task title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required aria-label="Title" />
        <input className="input" placeholder="Owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} aria-label="Owner" />
        <select className="input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} aria-label="Priority">{["low", "medium", "high"].map((p) => <option key={p}>{p}</option>)}</select>
        <input className="input" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} aria-label="Due date" />
        <button className="btn btn-primary">Add task</button>
        <textarea className="input md:col-span-6" rows={2} placeholder="Description (optional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </form>
      {err && <p role="alert" className="text-danger text-sm">{err}</p>}
      {tasks.length === 0 ? <p className="text-muted text-sm">No tasks yet. Add one above, or accept a task proposed by an agent.</p> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted"><tr><th className="p-3">Task</th><th>Priority</th><th>Due</th><th>Owner</th><th>Agent</th><th>Status</th></tr></thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t border-border align-top">
                  <td className="p-3"><div className="font-medium">{t.title}</div>{t.description && <div className="text-muted text-xs">{t.description}</div>}
                    <div className="text-muted text-xs">Created {t.created_at.slice(0, 10)}{t.completed_at && ` · Completed ${t.completed_at.slice(0, 10)}`}</div></td>
                  <td>{t.priority}</td><td>{t.due_date ?? "—"}</td><td>{t.owner ?? "—"}</td><td>{t.agent ?? "—"}</td>
                  <td><select className="input !w-auto" value={t.status} aria-label={`Status of ${t.title}`} onChange={(e) => wrap(() => call(`/api/tasks/${t.id}`, "PATCH", { status: e.target.value }))}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></td>
                </tr>))}
            </tbody>
          </table>
        </div>)}
    </div>
  );
}
