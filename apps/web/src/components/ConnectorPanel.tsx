"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, LogIn, LogOut, Trash2, Plus, ExternalLink } from "lucide-react";

type C = { name: string; url: string; transport: string; status: string; detail: string; source: string; can: { login: boolean; logout: boolean; remove: boolean } };
const LABEL: Record<string, [string, string]> = {
  connected: ["Connected", "text-good"], needs_auth: ["Needs sign-in", "text-warn"], failed: ["Failed", "text-danger"], not_configured: ["Not configured", "text-muted"], unknown: ["Unknown", "text-muted"],
};
const SRC: Record<string, string> = { claude_ai: "claude.ai connector", plugin: "plugin", own: "your Claude Code config" };

export default function ConnectorPanel() {
  const [list, setList] = useState<C[] | null>(null);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [add, setAdd] = useState({ name: "", url: "" });
  const [hideUnconfigured, setHide] = useState(true);

  const load = useCallback(async (refresh: boolean) => {
    setBusy(true);
    try {
      const j = await (await fetch(`/api/connectors${refresh ? "?refresh=1" : ""}`)).json();
      setList(j.connectors); setWhen(j.checkedAt); if (j.error) setMsg(j.error);
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }, []);
  useEffect(() => { load(false); }, [load]);

  async function act(body: Record<string, string>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true); setMsg("");
    const r = await fetch("/api/connectors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setMsg(j.message ?? j.error ?? `HTTP ${r.status}`);
    setBusy(false);
    if (body.action !== "login") load(true);
  }

  const rows = (list ?? []).filter((c) => !(hideUnconfigured && c.status === "not_configured"));
  return (
    <section className="card p-4 text-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Connectors (MCP)</h2>
        <button className="btn" disabled={busy} onClick={() => load(true)}>{busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Refresh health</button>
      </div>
      <p className="text-muted">Live status from Claude Code (<code>claude mcp list</code>)
        {when && `, checked ${new Date(when).toLocaleTimeString()}`}. Sign-in happens in your browser; this app never sees or stores passwords or tokens. Specialist chats can only use the read-only tools listed in each agent's definition.</p>
      {msg && <p role="status" className="rounded-lg bg-bg p-2">{msg}</p>}
      {list === null ? <p className="text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Checking connectors (up to 30 seconds)…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-left text-muted"><tr><th className="py-1 pr-3">Connector</th><th>Status</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.name} className="border-t border-border align-top">
                  <td className="py-2 pr-3"><div className="font-medium">{c.name}</div><div className="text-xs text-muted break-all">{c.url || "no address"}</div>{c.detail && <div className="text-xs text-danger">{c.detail}</div>}</td>
                  <td className={LABEL[c.status]?.[1]}>{LABEL[c.status]?.[0] ?? c.status}</td>
                  <td className="text-xs text-muted">{SRC[c.source]}</td>
                  <td className="py-2 text-right whitespace-nowrap space-x-1">
                    {c.can.login && <button className="btn !py-1" disabled={busy} onClick={() => act({ action: "login", name: c.name })}><LogIn size={12} />{c.status === "failed" ? "Re-authenticate" : "Authenticate"}</button>}
                    {c.can.logout && <button className="btn !py-1" disabled={busy} onClick={() => act({ action: "logout", name: c.name }, `Sign out of "${c.name}"? Agents lose access to it until you authenticate again.`)}><LogOut size={12} />Sign out</button>}
                    {c.can.remove && <button className="btn !py-1 text-danger" disabled={busy} onClick={() => act({ action: "remove", name: c.name }, `Remove "${c.name}" from Claude Code?`)}><Trash2 size={12} />Remove</button>}
                  </td>
                </tr>))}
            </tbody>
          </table>
          <label className="text-xs text-muted flex gap-2 mt-2"><input type="checkbox" checked={hideUnconfigured} onChange={(e) => setHide(e.target.checked)} />Hide connectors that are not configured</label>
        </div>)}
      <p className="text-xs text-muted">claude.ai connectors (Drive, Railway, Sentry…) are added or removed at <a className="underline inline-flex items-center gap-1" href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer">claude.ai/settings/connectors<ExternalLink size={10} /></a>; once connected they appear here for health checks and re-authentication.</p>
      <form className="grid gap-2 md:grid-cols-[1fr_2fr_auto] border-t border-border pt-3" onSubmit={(e) => { e.preventDefault(); act({ action: "add", ...add }, `Add the connector "${add.name}" at ${add.url}? Only add servers you trust: agents may send it information.`).then(() => setAdd({ name: "", url: "" })); }}>
        <input className="input" placeholder="Short name (letters, numbers, - _)" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} required aria-label="Connector name" />
        <input className="input" type="url" placeholder="https://… remote MCP server address" value={add.url} onChange={(e) => setAdd({ ...add, url: e.target.value })} required aria-label="Connector address" />
        <button className="btn btn-primary" disabled={busy}><Plus size={14} />Add</button>
      </form>
      <p className="text-xs text-muted">Only https remote servers that sign in with OAuth can be added here. Programs that run on this Mac (stdio) and API-key connectors are not supported from the app, because they can run code or need secrets; add those yourself in Claude Code. A newly added server's tools stay <b>blocked in app chats</b> until you approve them in the agent definition.</p>
    </section>
  );
}
