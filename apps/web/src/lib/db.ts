import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { dbPath } from "./paths.ts";

export const id = () => randomUUID();
export const now = () => new Date().toISOString();

const MIGRATIONS: string[] = [
  `CREATE TABLE conversations(id TEXT PRIMARY KEY, agent TEXT NOT NULL, title TEXT NOT NULL,
     claude_session_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
   CREATE TABLE messages(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
     role TEXT NOT NULL CHECK(role IN ('user','assistant','system')), content TEXT NOT NULL,
     meta TEXT, created_at TEXT NOT NULL);
   CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);
   CREATE TABLE tasks(id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
     priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
     status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','approved','in_progress','blocked','completed','cancelled')),
     due_date TEXT, owner TEXT, agent TEXT, conversation_id TEXT, report_id TEXT,
     created_at TEXT NOT NULL, completed_at TEXT);
   CREATE TABLE reports(id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, agent TEXT,
     conversation_id TEXT, created_at TEXT NOT NULL);
   CREATE TABLE report_versions(id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
     version INTEGER NOT NULL, content TEXT NOT NULL, sources TEXT, as_of TEXT, created_at TEXT NOT NULL,
     UNIQUE(report_id, version));
   CREATE TABLE approvals(id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, details TEXT NOT NULL,
     payload_hash TEXT NOT NULL, agent TEXT, conversation_id TEXT,
     status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','executed','expired')),
     requested_at TEXT NOT NULL, decided_at TEXT, decision_note TEXT, consumed_at TEXT, outcome TEXT);
   CREATE TABLE audit(id TEXT PRIMARY KEY, ts TEXT NOT NULL, event TEXT NOT NULL, detail TEXT);
   CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
   CREATE TABLE doc_links(id TEXT PRIMARY KEY, doc_path TEXT NOT NULL, report_id TEXT, conversation_id TEXT, created_at TEXT NOT NULL);`,
  // v2: context handed over when the founder opens a personal chat from a delegation
  `ALTER TABLE conversations ADD COLUMN handoff TEXT;`,
];

const g = globalThis as unknown as { __officeDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (g.__officeDb) return g.__officeDb;
  const d = new DatabaseSync(dbPath());
  d.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  migrate(d);
  g.__officeDb = d;
  return d;
}
export function closeDb() {
  g.__officeDb?.close();
  g.__officeDb = undefined;
}

export function migrate(d: DatabaseSync) {
  const v = (d.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
  for (let i = v; i < MIGRATIONS.length; i++) {
    d.exec("BEGIN");
    try {
      d.exec(MIGRATIONS[i]);
      d.exec(`PRAGMA user_version=${i + 1}`);
      d.exec("COMMIT");
    } catch (e) {
      d.exec("ROLLBACK");
      throw e;
    }
  }
}

export function audit(event: string, detail: unknown = {}) {
  getDb().prepare("INSERT INTO audit(id,ts,event,detail) VALUES(?,?,?,?)").run(id(), now(), event, JSON.stringify(detail));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type P = any[];
// node:sqlite returns null-prototype rows, which Next.js refuses to pass to client components.
const plain = <T>(r: unknown) => ({ ...(r as object) }) as T;
export const all = <T>(sql: string, ...p: P) => getDb().prepare(sql).all(...p).map((r) => plain<T>(r));
export const one = <T>(sql: string, ...p: P) => {
  const r = getDb().prepare(sql).get(...p);
  return r ? plain<T>(r) : undefined;
};
export const run = (sql: string, ...p: P) => getDb().prepare(sql).run(...p);

export function integrityCheck(): string {
  return (getDb().prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
}
