import { listAgents, listSkills } from "@/lib/agents";
import { authStatus } from "@/lib/claude";
import { integrityCheck } from "@/lib/db";
import { dataDir, backupDir, repoRoot } from "@/lib/paths";
import { approvedRoots } from "@/lib/documents";
import { listNotes } from "@/lib/notes";
import Link from "next/link";
import { BackupButton, ClearNotesButton } from "@/components/Actions";
import ConnectorPanel from "@/components/ConnectorPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await authStatus();
  const agents = listAgents();
  const skills = listSkills();
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="card p-4 space-y-1 text-sm"><h2 className="font-medium">AI connection</h2>
        <p>Claude Code CLI: {auth.cliFound ? "found" : "not found"} · Signed in: <b className={auth.loggedIn ? "text-good" : "text-danger"}>{auth.loggedIn ? "yes" : "no"}</b> · Method: {auth.authMethod}</p>
        <p className="text-muted">{auth.detail}</p>
        {auth.apiKeyInEnvironment && <p className="text-warn">An Anthropic API key variable is set in this environment. It is deliberately ignored: the app never passes it to Claude Code, so no pay-as-you-go API usage can occur.</p>}
        <p className="text-muted">Chat runs the official <code>claude -p</code> command with your own login (see docs/ai-auth-and-cost.md). Usage and cost totals are not shown because this app has no supported source for subscription usage; per-reply cost estimates, when Claude Code reports them, appear in message details.</p></section>
      <section className="card p-4 text-sm"><h2 className="font-medium mb-2">Agents ({agents.length})</h2>
        <ul>{agents.map((a) => <li key={a.slug}>{a.name} <span className="text-muted">— {a.statusNote}</span></li>)}</ul>
        <p className="mt-2 text-muted">Default agent: Chief of Staff. Model: each agent uses "inherit" (the model Claude Code is configured with).</p></section>
      <section className="card p-4 text-sm"><h2 className="font-medium mb-2">Skills ({skills.length})</h2><ul>{skills.map((s) => <li key={s.slug}>{s.slug}</li>)}</ul></section>
      <section className="card p-4 text-sm space-y-2"><h2 className="font-medium">Agent notes (memory across conversations)</h2>
        <p className="text-muted">Each agent keeps private, dated notes so it does not re-read and re-learn the same sources every time. They are hints, not facts: agents re-verify anything time-sensitive. Notes stay on this Mac and are not committed to Git. Clearing archives them.</p>
        <ul className="divide-y divide-border">{listNotes().map((n) => (
          <li key={n.agent} className="py-2 flex flex-wrap items-center justify-between gap-2">
            <span>{n.name} <span className="text-muted text-xs">{n.exists ? `· ${n.lines} lines · updated ${n.updated?.slice(0, 10)}` : "· no notes yet"}</span></span>
            {n.exists && <span className="flex gap-2 items-center"><Link className="btn !py-1" href="/documents">View</Link><ClearNotesButton agent={n.agent} name={n.name} /></span>}
          </li>))}</ul></section>
      <ConnectorPanel />
      <section className="card p-4 text-sm space-y-2"><h2 className="font-medium">Data and backup</h2>
        <p>Data folder: <code className="break-all">{dataDir()}</code><br />Backups: <code className="break-all">{backupDir()}</code><br />Repository: <code className="break-all">{repoRoot()}</code><br />Database check: {integrityCheck()} · Version 0.1.0</p>
        <p>Approved document folders:</p><ul className="text-xs text-muted">{approvedRoots().map((r) => <li key={r}>{r}</li>)}</ul><BackupButton /></section>
    </div>
  );
}
