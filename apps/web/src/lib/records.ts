import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.ts";
import { parseFrontmatter } from "./agents.ts";

/** Reads the existing repo records (records/{actions,risks,compliance,decisions}) read-only. */
export type RepoRecord = { kind: string; id: string; title: string; status: string; due: string; file: string };
const CLOSED = new Set(["done", "closed", "filed", "not_applicable", "rejected", "superseded", "accepted", "approved", "cancelled"]);

export function listRepoRecords(root = repoRoot()): RepoRecord[] {
  const out: RepoRecord[] = [];
  for (const [kind, folder] of [["action", "actions"], ["risk", "risks"], ["compliance", "compliance"], ["decision", "decisions"]] as const) {
    const dir = path.join(root, "records", folder);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md") || f.toLowerCase() === "readme.md") continue;
      const { data } = parseFrontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
      out.push({ kind, id: data.id || f, title: data.title || f, status: data.status || "unknown", due: data.due || data.review_by || "", file: `records/${folder}/${f}` });
    }
  }
  return out;
}
export const isOpen = (r: RepoRecord) => !CLOSED.has(r.status);

export type Fact = { file: string; verified: boolean; unverified: boolean; size: number };
/** Which authoritative fact files exist and whether they claim verification. Contents are not interpreted. */
export function factsStatus(root = repoRoot()): Fact[] {
  const dir = path.join(root, "company", "facts");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md").map((f) => {
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    const { data } = parseFrontmatter(t);
    return { file: f, verified: !!data.verified_on && !/TBD|UNVERIFIED/i.test(data.verified_on), unverified: /UNVERIFIED|\bTBD\b/.test(t), size: t.length };
  });
}
