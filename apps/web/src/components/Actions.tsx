"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquarePlus, Loader2, Trash2, Pencil, Check, X, DatabaseBackup, FileText } from "lucide-react";

async function api(url: string, method: string, data?: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

export function StartChat({ agent, label = "Start conversation", disabled }: { agent: string; label?: string; disabled?: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  return (
    <span>
      <button className="btn btn-primary" disabled={disabled} onClick={async () => {
        try { const c = await api("/api/conversations", "POST", { agent }); router.push(`/conversations/${c.id}`); } catch (e) { setErr((e as Error).message); }
      }}><MessageSquarePlus size={14} />{label}</button>
      {err && <span role="alert" className="text-danger text-xs ml-2">{err}</span>}
    </span>
  );
}

export function GenerateReport({ skill, reportId, label }: { skill: string; reportId?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <span>
      <button className="btn" disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        try { const r = await api("/api/reports", "POST", { skill, report_id: reportId }); router.push(`/reports/${r.id}`); router.refresh(); }
        catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
      }}>{busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}{busy ? "Generating… (can take minutes)" : label ?? `Generate ${skill}`}</button>
      {err && <p role="alert" className="text-danger text-xs mt-1 max-w-md">{err}</p>}
    </span>
  );
}

export function ConversationControls({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(title);
  if (editing)
    return (
      <span className="flex gap-1">
        <input className="input !w-64" value={val} onChange={(e) => setVal(e.target.value)} aria-label="Conversation title" />
        <button className="btn" aria-label="Save title" onClick={async () => { await api(`/api/conversations/${id}`, "PATCH", { title: val }); setEditing(false); router.refresh(); }}><Check size={14} /></button>
        <button className="btn" aria-label="Cancel" onClick={() => setEditing(false)}><X size={14} /></button>
      </span>
    );
  return (
    <span className="flex gap-1">
      <button className="btn" onClick={() => setEditing(true)}><Pencil size={14} />Rename</button>
      <button className="btn text-danger" onClick={async () => {
        if (!confirm("Delete this conversation and its history permanently? This cannot be undone.")) return;
        try { await api(`/api/conversations/${id}?confirm=yes`, "DELETE"); } catch (e) { alert((e as Error).message); return; }
        router.push("/conversations"); router.refresh();
      }}><Trash2 size={14} />Delete</button>
    </span>
  );
}

export function BackupButton() {
  const [msg, setMsg] = useState("");
  return (
    <div>
      <button className="btn" onClick={async () => { try { setMsg("Backed up to " + (await api("/api/backup", "POST")).file); } catch (e) { setMsg((e as Error).message); } }}><DatabaseBackup size={14} />Back up now</button>
      {msg && <p className="text-xs text-muted mt-1 break-all">{msg}</p>}
    </div>
  );
}

export function ApprovalDecision({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const decide = async (decision: "approved" | "rejected") => {
    try { await api(`/api/approvals/${id}`, "POST", { decision, note }); router.refresh(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input className="input !w-64" placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Decision note" />
      <button className="btn btn-primary" onClick={() => decide("approved")}><Check size={14} />Approve this action only</button>
      <button className="btn" onClick={() => decide("rejected")}><X size={14} />Reject</button>
      {err && <span role="alert" className="text-danger text-xs">{err}</span>}
    </div>
  );
}

export function NewApproval() {
  const router = useRouter();
  const [f, setF] = useState({ kind: "email", title: "", details: "" });
  const [err, setErr] = useState("");
  return (
    <form className="card p-4 space-y-2" onSubmit={async (e) => { e.preventDefault(); try { await api("/api/approvals", "POST", f); setF({ ...f, title: "", details: "" }); router.refresh(); } catch (x) { setErr((x as Error).message); } }}>
      <h3 className="font-medium text-sm">Record a proposed action manually</h3>
      <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Kind">
        {["email", "document_update", "repository_change", "deployment", "cloud_config", "financial_record", "share_confidential", "statutory_filing", "payment", "other"].map((k) => <option key={k}>{k}</option>)}
      </select>
      <input className="input" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required />
      <textarea className="input" rows={3} placeholder="Exact action / draft content to be approved" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} required />
      <button className="btn">Record request</button>
      {err && <p role="alert" className="text-danger text-xs">{err}</p>}
    </form>
  );
}

export function ClearNotesButton({ agent, name }: { agent: string; name: string }) {
  const router = useRouter();
  const [err, setErr] = useState("");
  return (
    <span>
      <button className="btn !py-1" onClick={async () => {
        if (!confirm(`Clear ${name}'s notes? They are archived (not destroyed) and the agent starts fresh.`)) return;
        try { await api("/api/agent-notes", "POST", { agent, confirm: "yes" }); router.refresh(); } catch (e) { setErr((e as Error).message); }
      }}><Trash2 size={12} />Clear</button>
      {err && <span role="alert" className="text-danger text-xs ml-2">{err}</span>}
    </span>
  );
}
