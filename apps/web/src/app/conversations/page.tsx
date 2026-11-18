import Link from "next/link";
import { listConversations } from "@/lib/store";
import { listAgents } from "@/lib/agents";
import { StartChat } from "@/components/Actions";

export const dynamic = "force-dynamic";

export default async function Conversations({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const convs = listConversations(q);
  const names = Object.fromEntries(listAgents().map((a) => [a.slug, a.name]));
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between gap-3"><h1 className="text-2xl font-semibold">Conversations</h1><StartChat agent="chief-of-staff" label="New with Chief of Staff" /></header>
      <form><input name="q" defaultValue={q} className="input" placeholder="Search conversations" aria-label="Search conversations" /></form>
      {convs.length === 0 ? <p className="text-muted text-sm">{q ? "No matches." : "No conversations yet. Pick a specialist in AI Team."}</p> : (
        <ul className="card divide-y divide-border">{convs.map((c) => (
          <li key={c.id}><Link href={`/conversations/${c.id}`} className="flex justify-between gap-3 p-3 hover:bg-bg text-sm"><span>{c.title}</span><span className="text-muted text-xs whitespace-nowrap">{names[c.agent] ?? c.agent} · {c.updated_at.slice(0, 16).replace("T", " ")}</span></Link></li>))}</ul>)}
    </div>
  );
}
