import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.ts";
import { listAgents } from "./agents.ts";
import { audit } from "./db.ts";

/** Agents' private notes live in company/agent-notes/<agent>/NOTES.md (written by the agents, read-only here). */
const notesRoot = () => path.join(repoRoot(), "company", "agent-notes");

export type NoteInfo = { agent: string; name: string; exists: boolean; lines: number; bytes: number; updated: string | null; path: string };

export function listNotes(): NoteInfo[] {
  return listAgents().map((a) => {
    const f = path.join(notesRoot(), a.slug, "NOTES.md");
    try {
      const st = fs.statSync(f);
      return { agent: a.slug, name: a.name, exists: true, lines: fs.readFileSync(f, "utf8").split("\n").length, bytes: st.size, updated: st.mtime.toISOString(), path: `company/agent-notes/${a.slug}/NOTES.md` };
    } catch {
      return { agent: a.slug, name: a.name, exists: false, lines: 0, bytes: 0, updated: null, path: `company/agent-notes/${a.slug}/NOTES.md` };
    }
  });
}

/** Archives (does not destroy) one agent's notes so it starts fresh. */
export function clearNotes(agent: string): boolean {
  if (!/^[a-z0-9-]+$/.test(agent) || !listAgents().some((a) => a.slug === agent)) throw new Error("Unknown agent");
  const f = path.join(notesRoot(), agent, "NOTES.md");
  if (!fs.existsSync(f)) return false;
  const dir = path.join(notesRoot(), "_cleared", agent);
  fs.mkdirSync(dir, { recursive: true });
  fs.renameSync(f, path.join(dir, `NOTES-${new Date().toISOString().replace(/[:.]/g, "-")}.md`));
  audit("notes.clear", { agent });
  return true;
}
