"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Wrench, Mic, MicOff, UserRound, MessageSquarePlus, Square, Paperclip, X, FileText } from "lucide-react";
import { Md, CopyButton } from "./Md";

type Msg = { id: string; role: "user" | "assistant" | "system"; content: string; meta: string | null; created_at: string };
type Step = { kind: "tool"; name: string; summary: string } | { kind: "text"; text: string };
type Deleg = { id: string; agent: string; description: string; brief: string; result: string; steps: Step[] };
type Appr = { id: string; status: string; details: string; outcome: string | null };
type Att = { name: string; path: string; size: number };
type Pending = { key: string; name: string; size: number; path?: string; error?: string; readable?: boolean };
const MAX_BYTES = 20 * 1024 * 1024;
const kb = (n: number) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
type Meta = { attachments?: Att[]; saveToDrive?: boolean; driveWrites?: { approvalId: string; title: string; fileName: string }[]; driveResult?: { ok: boolean; text: string }; tools?: { name: string; summary: string }[]; delegations?: Deleg[]; sources?: string[]; denials?: string[] };
type Live = { text: string; status: string; tools: string[]; deleg: Deleg[] };
const EMPTY: Live = { text: "", status: "", tools: [], deleg: [] };

const pretty = (slug: string) => slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
const clean = (r: string) => r.replace(/^\[Subagent hand-back\][^\n]*\n?/i, "").trim();

/** The Chief of Staff's conversation with a specialist, shown like a group chat. */
function Delegation({ d, onOpen, live }: { d: Deleg; onOpen?: () => void; live?: boolean }) {
  const name = pretty(d.agent);
  const texts = d.steps.filter((s) => s.kind === "text") as { kind: "text"; text: string }[];
  const tools = d.steps.filter((s) => s.kind === "tool") as { kind: "tool"; name: string; summary: string }[];
  return (
    <div className="mt-3 rounded-lg border border-border bg-bg p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium flex items-center gap-1"><UserRound size={14} />Chief of Staff → {name}{d.description && <span className="text-muted font-normal"> · {d.description}</span>}</span>
        {live && !d.result && <span className="text-xs text-muted flex items-center gap-1"><Loader2 size={12} className="animate-spin" />working</span>}
      </div>
      <div className="rounded-lg bg-panel border border-border px-3 py-2"><div className="text-xs text-muted mb-1">Brief from Chief of Staff</div><div className="whitespace-pre-wrap">{d.brief}</div></div>
      {tools.length > 0 && (
        <details className="text-xs text-muted"><summary className="cursor-pointer">{name} used {tools.length} tool call(s)</summary>
          <ul className="mt-1 space-y-0.5">{tools.map((t, i) => <li key={i}><b>{t.name}</b> {t.summary}</li>)}</ul></details>)}
      {(d.result || texts.length > 0) && (
        <div className="rounded-lg bg-panel border border-border px-3 py-2"><div className="text-xs text-muted mb-1">{name}</div>
          <Md>{clean(d.result) || texts.map((t) => t.text).join("\n\n")}</Md></div>)}
      {onOpen && d.result && <button className="btn" onClick={onOpen}><MessageSquarePlus size={14} />Continue with {name} directly</button>}
    </div>
  );
}

type SR = { start(): void; stop(): void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };

export default function Chat({ conversationId, agentName, initial, aiReady, aiNote, handoff, driveApprovals }: { conversationId: string; agentName: string; initial: Msg[]; aiReady: boolean; aiNote: string; handoff?: string | null; driveApprovals?: Appr[] }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [appr, setAppr] = useState<Appr[]>(driveApprovals ?? []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<Live>(EMPTY);
  const [err, setErr] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [toDrive, setToDrive] = useState(false);
  const [drag, setDrag] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(true);
  const rec = useRef<SR | null>(null);
  const base = useRef("");
  const end = useRef<HTMLDivElement>(null);
  const alive = useRef(true); // false once the page is left: stop touching state, but the server keeps working
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, live]);
  useEffect(() => { setVoiceOk(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); }, []);
  useEffect(() => () => rec.current?.stop(), []);

  function toggleVoice() {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    const r: SR = new Ctor();
    r.continuous = true; r.interimResults = true; r.lang = navigator.language || "en-IN";
    base.current = input ? input.replace(/\s*$/, " ") : "";
    r.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(base.current + t);
    };
    r.onerror = (e: any) => { setErr(e.error === "not-allowed" ? "Microphone permission was denied. Allow it in the browser's site settings for localhost." : `Voice input error: ${e.error}`); setListening(false); };
    r.onend = () => setListening(false);
    rec.current = r; setErr(""); r.start(); setListening(true);
  }

  /** Read an NDJSON turn stream (new turn or re-attach) into the live view. Resolves when the turn ends. */
  const consume = useCallback(async (body: ReadableStream<Uint8Array>): Promise<boolean> => {
    const reader = body.getReader(); const dec = new TextDecoder(); let buf = ""; let terminal = false;
    for (;;) {
      const { done, value } = await reader.read(); if (done || !alive.current) { if (!alive.current) reader.cancel().catch(() => {}); break; }
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        const ev = JSON.parse(line);
        if (ev.type === "result" || ev.type === "error") terminal = true;
        if (ev.type === "text") setLive((l) => ({ ...l, text: l.text + ev.text, status: "Writing…" }));
        else if (ev.type === "tool") setLive((l) => ({ ...l, status: `Using ${ev.name}`, tools: [...l.tools, `${ev.name}: ${ev.summary}`] }));
        else if (ev.type === "delegate") setLive((l) => {
          const deleg = l.deleg.map((d) => ({ ...d, steps: [...d.steps] }));
          if (ev.phase === "start") deleg.push({ id: ev.id, agent: ev.agent, description: ev.description, brief: ev.brief, steps: [], result: "" });
          const d = deleg.find((x) => x.id === ev.id);
          if (d && ev.phase === "tool") d.steps.push({ kind: "tool", name: ev.name, summary: ev.summary });
          if (d && ev.phase === "text") d.steps.push({ kind: "text", text: ev.text });
          if (d && ev.phase === "end") d.result = ev.result;
          return { ...l, deleg, status: ev.phase === "end" ? "Chief of Staff is consolidating…" : `${pretty(d?.agent ?? "specialist")} is working…` };
        });
        else if (ev.type === "error") setErr(ev.message);
      }
    }
    return terminal;
  }, []);

  /**
   * The connection can drop while the server keeps working (Mac sleep, Wi-Fi change, tab throttled in the background).
   * Never show that as a failure: keep trying to re-attach to the running job until it ends, then load the saved answer.
   */
  const follow = useCallback(async (first: ReadableStream<Uint8Array> | null) => {
    let body = first;
    const deadline = Date.now() + 30 * 60_000;
    for (let n = 0; alive.current && Date.now() < deadline; n++) {
      if (body) {
        try { if (await consume(body)) return; } catch { /* connection dropped: fall through and re-attach */ }
        body = null;
      }
      if (!alive.current) return;
      setLive((l) => ({ ...l, status: "Connection interrupted. Reconnecting; the agent keeps working…" }));
      await new Promise((r) => setTimeout(r, Math.min(1500 * (n + 1), 10_000)));
      try {
        const res = await fetch(`/api/conversations/${conversationId}/stream`);
        if (res.status === 204) return; // the job has finished; the answer is saved
        if (res.status === 200 && res.body) { setLive({ ...EMPTY, status: "Reconnected…" }); body = res.body; }
      } catch { /* still offline: try again */ }
    }
  }, [conversationId, consume]);

  const finish = useCallback(async () => {
    if (!alive.current) return;
    // Reload the persisted history: the server is the source of truth.
    const r = await fetch(`/api/conversations/${conversationId}`);
    if (r.ok && alive.current) { const j = await r.json(); setMsgs(j.messages); setAppr(j.driveApprovals ?? []); }
    if (!alive.current) return;
    setLive(EMPTY); setBusy(false);
    router.refresh(); // update the server-rendered header (session status)
  }, [conversationId, router]);

  // Coming back to a conversation whose agent is still working (or just finished): re-attach to it.
  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}/stream`);
        if (res.status === 200 && res.body && alive.current) {
          setBusy(true); setLive({ ...EMPTY, status: "Reconnected. The agent kept working while you were away…" });
          await follow(res.body); await finish();
        }
      } catch { /* nothing running */ }
    })();
    return () => { alive.current = false; };
  }, [conversationId, follow, finish]);

  const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader(); r.onerror = () => reject(new Error("Could not read the file"));
    r.onload = () => resolve(String(r.result).split(",")[1] ?? ""); r.readAsDataURL(f);
  });
  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    for (const f of Array.from(list)) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (f.size > MAX_BYTES) { setFiles((x) => [...x, { key, name: f.name, size: f.size, error: "Larger than 20 MB" }]); continue; }
      setFiles((x) => [...x, { key, name: f.name, size: f.size }]);
      try {
        const res = await fetch(`/api/conversations/${conversationId}/attachments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, data: await toBase64(f) }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        setFiles((x) => x.map((p) => (p.key === key ? { ...p, path: j.path, name: j.name, readable: j.readable } : p)));
      } catch (e) { setFiles((x) => x.map((p) => (p.key === key ? { ...p, error: (e as Error).message } : p))); }
    }
  }
  async function dropFile(p: Pending) {
    setFiles((x) => x.filter((y) => y.key !== p.key));
    if (p.path) await fetch(`/api/conversations/${conversationId}/attachments?path=${encodeURIComponent(p.path)}`, { method: "DELETE" }).catch(() => {});
  }
  const ready = files.filter((f) => f.path);
  const uploading = files.some((f) => !f.path && !f.error);

  async function send() {
    const prompt = input.trim();
    if ((!prompt && !ready.length) || busy || uploading) return;
    rec.current?.stop();
    const sendFiles = ready; const drive = toDrive;
    setInput(""); setErr(""); setBusy(true); setFiles(files.filter((f) => f.error)); setToDrive(false);
    setMsgs((m) => [...m, { id: "tmp" + Date.now(), role: "user", content: prompt, meta: sendFiles.length ? JSON.stringify({ attachments: sendFiles.map((f) => ({ name: f.name, path: f.path, size: f.size })), saveToDrive: drive }) : null, created_at: new Date().toISOString() }]);
    setLive({ ...EMPTY, status: "Thinking…" });
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, attachments: sendFiles.map((f) => f.path), saveToDrive: drive }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      await follow(res.body);
    } catch (e) {
      // A network failure before the server accepted the message: check whether it started anyway.
      if (e instanceof TypeError) await follow(null); else if (alive.current) setErr((e as Error).message);
    }
    await finish();
  }

  /** Founder clicks Approve: record the decision, then let the agent make exactly that one Drive call. */
  async function approveWrite(aid: string) {
    if (busy) return;
    setErr(""); setBusy(true); setLive({ ...EMPTY, status: "Saving the approved file to Drive…" });
    try {
      const cur = appr.find((a) => a.id === aid);
      if (cur?.status === "pending") {
        const d = await fetch(`/api/approvals/${aid}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "approved" }) });
        if (!d.ok) throw new Error((await d.json().catch(() => ({}))).error ?? `HTTP ${d.status}`);
      }
      const res = await fetch(`/api/conversations/${conversationId}/drive-write`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvalId: aid }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      await follow(res.body);
    } catch (e) { if (e instanceof TypeError) await follow(null); else if (alive.current) setErr((e as Error).message); }
    await finish();
  }
  async function rejectWrite(aid: string) {
    const d = await fetch(`/api/approvals/${aid}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "rejected" }) });
    if (!d.ok) return setErr((await d.json().catch(() => ({}))).error ?? `HTTP ${d.status}`);
    await finish();
  }

  async function stop() {
    await fetch(`/api/conversations/${conversationId}/stream`, { method: "DELETE" });
  }

  async function openDirect(messageId: string, delegationId: string) {
    const r = await fetch(`/api/conversations/${conversationId}/handoff`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, delegationId }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? `HTTP ${r.status}`);
    router.push(`/conversations/${j.id}`);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-11rem)] md:h-[calc(100vh-9rem)]">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1" aria-live="polite">
        {handoff && (
          <details className="card p-3 text-sm"><summary className="cursor-pointer">Continuing from a Chief of Staff conversation. The context below is shared with {agentName} automatically.</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted">{handoff}</pre></details>)}
        {msgs.length === 0 && <p className="text-muted text-sm">Start the conversation with {agentName}.</p>}
        {msgs.map((m) => {
          const meta: Meta = m.meta ? JSON.parse(m.meta) : {};
          if (m.role === "user") return (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl bubble-user px-4 py-2 text-sm">
              {!!meta.attachments?.length && <div className="flex flex-wrap gap-1 mb-1">{meta.attachments.map((a) => <span key={a.path} className="inline-flex items-center gap-1 rounded-md bg-black/15 px-2 py-0.5 text-xs"><FileText size={11} />{a.name} ({kb(a.size)})</span>)}</div>}
              {meta.saveToDrive && <div className="text-xs opacity-80 mb-1">Also save to Google Drive (each file needs your approval)</div>}
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>);
          if (m.role === "system") return <div key={m.id} className="card border-danger px-4 py-2 text-sm text-danger" role="alert">{m.content}</div>;
          return (
            <div key={m.id} className="card px-4 py-3">
              {meta.delegations?.map((d) => <Delegation key={d.id} d={d} onOpen={() => openDirect(m.id, d.id)} />)}
              <div className={meta.delegations?.length ? "mt-3" : ""}>
                {!!meta.delegations?.length && <div className="text-xs text-muted mb-1">{agentName}</div>}
                <Md>{m.content}</Md>
              </div>
              {meta.driveWrites?.map((w) => {
                const a = appr.find((x) => x.id === w.approvalId);
                let preview = a?.details ?? "";
                try { const j = JSON.parse(preview); preview = Object.entries(j.input ?? {}).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`).join("\n\n"); } catch { /* show raw */ }
                return (
                  <div key={w.approvalId} className="mt-3 rounded-lg border border-border bg-bg p-3 text-sm space-y-2">
                    <div className="font-medium">Waiting for your approval: create "{w.fileName}" in Google Drive</div>
                    <details><summary className="cursor-pointer text-xs text-muted">Show exactly what will be saved</summary>
                      <pre className="mt-1 whitespace-pre-wrap text-xs max-h-72 overflow-y-auto">{preview.slice(0, 6000)}</pre></details>
                    {a?.status === "pending" && <div className="flex gap-2"><button className="btn btn-primary" disabled={busy} onClick={() => approveWrite(w.approvalId)}>Approve and save to Drive</button><button className="btn" disabled={busy} onClick={() => rejectWrite(w.approvalId)}>Reject</button></div>}
                    {a?.status === "approved" && <button className="btn btn-primary" disabled={busy} onClick={() => approveWrite(w.approvalId)}>Approved. Save to Drive now</button>}
                    {a?.status === "rejected" && <p className="text-xs text-muted">Rejected. Nothing was saved.</p>}
                    {a?.status === "executed" && <p className="text-xs text-muted">Approved and used once. Result: {a.outcome ?? "unknown"}</p>}
                  </div>);
              })}
              {meta.driveResult && <p className={`mt-2 text-xs ${meta.driveResult.ok ? "text-muted" : "text-warn"}`}>Drive: {meta.driveResult.ok ? "created" : "NOT confirmed"}. {meta.driveResult.text.slice(0, 300)}</p>}
              {!!meta.tools?.length && (
                <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer"><Wrench size={11} className="inline mr-1" />{meta.tools.length} tool call(s)</summary>
                  <ul className="mt-1 space-y-0.5">{meta.tools.map((t, i) => <li key={i}><b>{t.name}</b> {t.summary}</li>)}</ul></details>)}
              {!!meta.sources?.length && (
                <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer">{meta.sources.length} source reference(s) mentioned</summary>
                  <ul className="mt-1">{meta.sources.map((s) => <li key={s} className="break-all">{s}</li>)}</ul></details>)}
              {!!meta.denials?.length && <p className="mt-1 text-xs text-warn">Blocked by permissions: {[...new Set(meta.denials)].join(", ")}</p>}
              <div className="mt-2"><CopyButton text={m.content} /></div>
            </div>
          );
        })}
        {busy && (
          <div className="card px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-sm text-muted">
              <span className="flex items-center gap-2"><span className="orb" aria-hidden="true" />{live.status} <span className="text-xs">(you can leave this page; it keeps working)</span></span>
              <button type="button" className="btn !py-1" onClick={stop}><Square size={12} />Stop</button>
            </div>
            {live.deleg.map((d) => <Delegation key={d.id} d={d} live />)}
            {live.text && <div className="mt-3"><Md>{live.text}</Md></div>}
            {live.tools.length > 0 && <ul className="mt-2 text-xs text-muted">{live.tools.slice(-5).map((t, i) => <li key={i}>{t}</li>)}</ul>}
          </div>
        )}
        <div ref={end} />
      </div>
      {err && <p role="alert" className="text-danger text-sm mt-2">{err}</p>}
      {!aiReady && <p className="text-warn text-sm mt-2">AI is unavailable: {aiNote}</p>}
      {files.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="flex flex-wrap gap-2">
            {files.map((f) => (
              <span key={f.key} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${f.error ? "border-danger text-danger" : "border-border"}`} title={f.error}>
                {!f.path && !f.error ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                {f.name} ({kb(f.size)}){f.error ? `: ${f.error}` : ""}{f.path && f.readable === false ? " (saved, but the agent cannot read this type)" : ""}
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => dropFile(f)}><X size={12} /></button>
              </span>))}
          </div>
          {ready.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={toDrive} onChange={(e) => setToDrive(e.target.checked)} />
              Also save {ready.length > 1 ? "these files" : "this file"} to Google Drive as the final copy (you approve each file)</label>)}
        </div>)}
      <form className={`flex gap-2 mt-3 ${drag ? "ring-2 ring-accent rounded-lg" : ""}`} onSubmit={(e) => { e.preventDefault(); send(); }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}>
        <input ref={pick} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <textarea className="input min-h-[3rem]" rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Listening… speak now" : `Message ${agentName}… (drop files here to attach)`}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }} aria-label="Message" />
        <button type="button" className="btn" onClick={() => pick.current?.click()} aria-label="Attach files" title="Attach files (up to 20 MB each). They are saved on this Mac so the agent can read them."><Paperclip size={14} />Attach</button>
        {voiceOk && (
          <button type="button" className={`btn ${listening ? "!border-danger text-danger" : ""}`} onClick={toggleVoice} aria-pressed={listening}
            aria-label={listening ? "Stop voice input" : "Start voice input"} title="Voice to text. Your browser sends the audio to its speech service to transcribe it.">
            {listening ? <MicOff size={14} /> : <Mic size={14} />}{listening ? "Stop" : "Voice"}
          </button>)}
        <button className="btn btn-primary" disabled={busy || uploading || (!input.trim() && !ready.length)} aria-label="Send"><Send size={14} />Send</button>
      </form>
      {voiceOk && <p className="text-xs text-muted mt-1">Voice input uses your browser's speech recognition (Chrome and Safari send the audio to Google or Apple to transcribe). Avoid dictating highly confidential details if that is a concern.</p>}
      {!voiceOk && <p className="text-xs text-muted mt-1">Voice input is not supported by this browser. Use Chrome or Safari.</p>}
    </div>
  );
}
