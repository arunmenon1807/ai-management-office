import { listAgents } from "@/lib/agents";
import { StartChat } from "@/components/Actions";

export const dynamic = "force-dynamic";

export default function Team() {
  const agents = listAgents();
  return (
    <div className="space-y-6">
      <header><h1 className="text-2xl font-semibold">AI Team</h1>
        <p className="text-muted text-sm">Discovered from .claude/agents and CLAUDE.md. "Definition valid" means the file parses; it does not prove the agent runs. Test it in a conversation.</p></header>
      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((a) => (
          <article key={a.slug} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div><h2 className="font-semibold">{a.name}</h2><p className="text-xs text-muted">{a.slug} · {a.source}</p></div>
              <span className={`badge ${a.status === "error" ? "!text-danger" : "!text-good"}`}>{a.status === "error" ? "Misconfigured" : "Definition valid"}</span>
            </div>
            <p className="text-sm">{a.description}</p>
            {a.statusNote && <p className="text-xs text-muted">{a.statusNote}</p>}
            {!!a.responsibilities.length && <div><h3 className="text-xs font-medium text-muted uppercase">Responsibilities</h3><ul className="list-disc ml-5 text-sm">{a.responsibilities.slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
            {!!a.limitations.length && <div><h3 className="text-xs font-medium text-muted uppercase">Limits</h3><ul className="list-disc ml-5 text-sm">{a.limitations.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
            <div className="text-xs"><b>Integrations (from tool list):</b> {a.integrations.join(", ") || "none"}<br /><b>Skills:</b> {a.skills.join(", ") || "none linked"}</div>
            <StartChat agent={a.slug} disabled={a.status === "error"} />
          </article>))}
      </div>
    </div>
  );
}
