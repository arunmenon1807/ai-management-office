"use client";
import { useEffect, useState } from "react";
import { Folder, File, ExternalLink, Search } from "lucide-react";
import { Md } from "./Md";

type Entry = { name: string; path: string; isDir: boolean; size: number; modified: string; ext: string };

export default function DocBrowser() {
  const [roots, setRoots] = useState<string[]>([]);
  const [dir, setDir] = useState<{ path: string; entries: Entry[] } | null>(null);
  const [doc, setDoc] = useState<{ path: string; content: string; truncated: boolean } | null>(null);
  const [hits, setHits] = useState<{ path: string; line: number; text: string }[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const get = async (url: string) => { const r = await fetch(url); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; };
  useEffect(() => { get("/api/documents").then((j) => setRoots(j.roots)).catch((e) => setErr(e.message)); }, []);
  const open = (p: string) => get(`/api/documents?path=${encodeURIComponent(p)}`).then((j) => { setDir(j); setDoc(null); setHits(null); setErr(""); }).catch((e) => setErr(e.message));
  const read = (p: string) => get(`/api/documents?read=1&path=${encodeURIComponent(p)}`).then((j) => { setDoc(j); setErr(""); }).catch((e) => setErr(e.message));
  const launch = (p: string) => fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: p }) });

  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (q.trim()) setHits(await get(`/api/documents?q=${encodeURIComponent(q)}`)); }}>
        <input className="input" placeholder="Search text in approved documents" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search documents" />
        <button className="btn"><Search size={14} />Search</button>
      </form>
      {err && <p role="alert" className="text-danger text-sm">{err}</p>}
      {hits && (hits.length === 0 ? <p className="text-muted text-sm">No matches.</p> :
        <ul className="card divide-y divide-border text-sm">{hits.map((h, i) => <li key={i} className="p-2"><button className="text-accent underline break-all" onClick={() => read(h.path)}>{h.path.split("/").slice(-3).join("/")}:{h.line}</button><div className="text-muted">{h.text}</div></li>)}</ul>)}
      {!dir && !hits && (
        <div className="card p-4"><h2 className="font-medium text-sm mb-2">Approved folders</h2>
          <ul className="space-y-1">{roots.map((r) => <li key={r}><button className="flex items-center gap-2 text-sm hover:text-accent" onClick={() => open(r)}><Folder size={14} />{r.split("/").slice(-2).join("/")}</button></li>)}</ul>
          <p className="text-muted text-xs mt-3">Only these folders can be browsed. company/private is never included by default.</p></div>)}
      {dir && !hits && (
        <div className="card">
          <div className="p-3 text-xs text-muted break-all border-b border-border">{dir.path}</div>
          <ul>{dir.entries.map((e) => (
            <li key={e.path} className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 text-sm">
              {e.isDir ? <Folder size={14} /> : <File size={14} />}
              <button className="flex-1 text-left hover:text-accent" onClick={() => (e.isDir ? open(e.path) : read(e.path))}>{e.name}</button>
              <span className="text-muted text-xs">{e.isDir ? "" : `${(e.size / 1024).toFixed(1)} KB`} · {e.modified.slice(0, 10)}</span>
              {!e.isDir && <button className="btn !py-1 !px-2" onClick={() => launch(e.path)} aria-label={`Open ${e.name} in default app`}><ExternalLink size={12} /></button>}
            </li>))}</ul>
        </div>)}
      {doc && (
        <div className="card p-4"><div className="text-xs text-muted break-all mb-2">{doc.path}{doc.truncated && " (truncated)"}</div>
          {doc.path.endsWith(".md") ? <Md>{doc.content}</Md> : <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{doc.content}</pre>}</div>)}
    </div>
  );
}
