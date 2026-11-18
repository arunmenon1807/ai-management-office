import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const E = process["env"];

/** Repo root (holds CLAUDE.md and .claude/). Override with AIMO_ROOT. */
export function repoRoot(): string {
  if (E.AIMO_ROOT) return path.resolve(E.AIMO_ROOT);
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "CLAUDE.md")) && fs.existsSync(path.join(dir, ".claude"))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(process.cwd(), "../..");
}

/** App-owned data (SQLite, reports, backups). Never inside the repo or served assets. */
export function dataDir(): string {
  const d = E.AIMO_DATA_DIR
    ? path.resolve(E.AIMO_DATA_DIR)
    : path.join(os.homedir(), "Library", "Application Support", "AI Management Office");
  fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
}
export const dbPath = () => path.join(dataDir(), "office.db");
export const backupDir = () => {
  const d = path.join(dataDir(), "backups");
  fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  return d;
};
