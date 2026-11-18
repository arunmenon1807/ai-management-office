import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.ts";
import { safeResolve, isSecretFile } from "./security.ts";
import { getSetting } from "./store.ts";

/** Approved roots: defaults are non-sensitive repo folders. company/private is NOT approved by default. */
export function approvedRoots(): string[] {
  const root = repoRoot();
  const defaults = ["company/facts", "company/conclusions", "company/agent-notes", "records", "docs"].map((p) => path.join(root, p));
  let extra: string[] = [];
  try { extra = JSON.parse(getSetting("approved_doc_roots", "[]")); } catch { /* ignore */ }
  return [...defaults, ...extra.filter((p) => path.isAbsolute(p))].filter((p) => fs.existsSync(p));
}

export type DocEntry = { name: string; path: string; isDir: boolean; size: number; modified: string; ext: string };

export function listDir(target: string | null): { path: string; entries: DocEntry[] } | { roots: string[] } | { error: string } {
  if (!target) return { roots: approvedRoots() };
  const real = safeResolve(target, approvedRoots());
  if (!real) return { error: "Path is outside the approved folders" };
  let st: fs.Stats;
  try { st = fs.statSync(real); } catch { return { error: "Not found" }; }
  if (!st.isDirectory()) return { error: "Not a folder" };
  const entries = fs.readdirSync(real, { withFileTypes: true })
    .filter((d) => !d.name.startsWith(".") && !isSecretFile(d.name))
    .map((d) => {
      const p = path.join(real, d.name);
      const s = fs.statSync(p);
      return { name: d.name, path: p, isDir: d.isDirectory(), size: s.size, modified: s.mtime.toISOString(), ext: path.extname(d.name).slice(1).toLowerCase() };
    })
    .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  return { path: real, entries };
}

export function readDoc(target: string): { path: string; content: string; truncated: boolean } | { error: string } {
  const real = safeResolve(target, approvedRoots());
  if (!real || isSecretFile(real)) return { error: "Path is outside the approved folders" };
  const st = fs.statSync(real);
  if (!st.isFile()) return { error: "Not a file" };
  if (!/\.(md|txt|csv|json|ya?ml)$/i.test(real)) return { error: "Preview supports text files only. Use Open to launch it in its own viewer." };
  const max = 200_000;
  const buf = fs.readFileSync(real);
  return { path: real, content: buf.subarray(0, max).toString("utf8"), truncated: buf.length > max };
}

export function searchDocs(q: string, limit = 50): { path: string; line: number; text: string }[] {
  const out: { path: string; line: number; text: string }[] = [];
  const needle = q.toLowerCase();
  const walk = (dir: string, depth: number) => {
    if (out.length >= limit || depth > 6) return;
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.name.startsWith(".") || isSecretFile(d.name) || d.isSymbolicLink()) continue;
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p, depth + 1);
      else if (/\.(md|txt|csv)$/i.test(d.name)) {
        const lines = fs.readFileSync(p, "utf8").split("\n");
        for (let i = 0; i < lines.length && out.length < limit; i++)
          if (lines[i].toLowerCase().includes(needle)) out.push({ path: p, line: i + 1, text: lines[i].trim().slice(0, 200) });
      }
    }
  };
  for (const r of approvedRoots()) walk(r, 0);
  return out;
}
