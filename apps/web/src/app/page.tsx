import Link from "next/link";
import { ListChecks, ShieldCheck, TriangleAlert, CalendarClock } from "lucide-react";
import { all } from "@/lib/db";
import { listAgents, listSkills } from "@/lib/agents";
import { listRepoRecords, isOpen, factsStatus } from "@/lib/records";
import { authStatus } from "@/lib/claude";
import { StartChat, GenerateReport } from "@/components/Actions";
import OfficeScene from "@/components/OfficeScene";
import type { Task, Approval, Report, Conversation } from "@/lib/store";

export const dynamic = "force-dynamic";

const Stat = ({ label, value, href, icon: Icon }: { label: string; value: number | string; href?: string; icon: React.ComponentType<{ size?: number }> }) => {
  const inner = <div className="card p-4"><div className="flex items-center justify-between text-muted"><span className="text-sm">{label}</span><Icon size={16} /></div><div className="text-3xl font-semibold stat-num grad-text mt-1">{value}</div></div>;
  return href ? <Link href={href}>{inner}</Link> : inner;
};
const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-muted text-sm">{children}</p>;

export default async function Dashboard() {
  const tasks = all<Task>("SELECT * FROM tasks WHERE status NOT IN ('completed','cancelled') ORDER BY COALESCE(due_date,'9999') LIMIT 50");
  const approvals = all<Approval>("SELECT * FROM approvals WHERE status='pending' ORDER BY requested_at");
  const reports = all<Report & { latest: string }>("SELECT r.*, (SELECT MAX(created_at) FROM report_versions v WHERE v.report_id=r.id) latest FROM reports r ORDER BY latest DESC LIMIT 5");
  const convs = all<Conversation>("SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 5");
  const records = listRepoRecords();
  const risks = records.filter((r) => r.kind === "risk" && isOpen(r));
  const compliance = records.filter((r) => r.kind === "compliance" && isOpen(r));
  const facts = factsStatus();
  const agents = listAgents();
  const skills = listSkills();
  const auth = await authStatus();
  const today = new Date().toISOString().slice(0, 10);
  const priority = [
    ...approvals.map((a) => ({ k: "Approval", t: a.title, href: "/approvals" })),
    ...tasks.filter((t) => t.priority === "high" || (t.due_date && t.due_date <= today)).map((t) => ({ k: t.due_date && t.due_date < today ? "Overdue task" : "Task", t: t.title, href: "/tasks" })),
  ].slice(0, 6);
  const has = (s: string) => skills.some((x) => x.slug === s);
  const hasAgent = (s: string) => agents.some((a) => a.slug === s && a.status !== "error");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl hero-title"><span className="grad-text">Mission control</span></h1><p className="text-muted text-sm mt-1">Only real, recorded information is shown. Empty means nothing is recorded yet.</p></div>
        <span className="status-pill" role="status"><span className={`status-dot ${auth.loggedIn ? "" : "off"}`} />{auth.loggedIn ? "AI online" : "AI offline"}</span>
      </header>
      {!auth.loggedIn && <div className="card border-warn p-4 text-sm" role="status">AI is unavailable: {auth.detail}</div>}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Open tasks" value={tasks.length} href="/tasks" icon={ListChecks} /><Stat label="Pending approvals" value={approvals.length} href="/approvals" icon={ShieldCheck} />
        <Stat label="Open risks (repo records)" value={risks.length} icon={TriangleAlert} /><Stat label="Open compliance items (repo records)" value={compliance.length} icon={CalendarClock} />
      </section>
      <section><h2 className="font-medium mb-2">Priority actions</h2>
        {priority.length ? <ul className="card divide-y divide-border">{priority.map((p, i) => <li key={i}><Link className="flex gap-3 p-3 text-sm hover:bg-bg" href={p.href}><span className="badge">{p.k}</span>{p.t}</Link></li>)}</ul> : <Empty>Nothing needs your attention.</Empty>}</section>
      <section><div className="flex items-center justify-between mb-2"><h2 className="font-medium">The Office</h2><Link className="text-sm text-accent underline" href="/office">Open full view</Link></div><OfficeScene compact /></section>
      <section><h2 className="font-medium mb-2">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {hasAgent("chief-of-staff") && <StartChat agent="chief-of-staff" label="Ask Chief of Staff" />}
          {hasAgent("company-secretary") && <StartChat agent="company-secretary" label="Talk to Company Secretary" />}
          {hasAgent("cfo") && <StartChat agent="cfo" label="Ask CFO" />}
          {has("daily-brief") && <GenerateReport skill="daily-brief" label="Daily brief" />}
          {has("weekly-review") && <GenerateReport skill="weekly-review" label="Weekly report" />}
          {has("monthly-business-review") && <GenerateReport skill="monthly-business-review" label="Review business" />}
          {has("compliance-check") && <GenerateReport skill="compliance-check" label="Review compliance" />}
          {has("technology-review") && <GenerateReport skill="technology-review" label="Review technology" />}
          <Link className="btn" href="/approvals">View pending approvals</Link>
        </div></section>
      <div className="grid md:grid-cols-2 gap-6">
        <section><h2 className="font-medium mb-2">Latest reports</h2>
          {reports.length ? <ul className="card divide-y divide-border">{reports.map((r) => <li key={r.id}><Link className="block p-3 text-sm hover:bg-bg" href={`/reports/${r.id}`}>{r.title}<div className="text-xs text-muted">{r.agent ?? "manual"} · {r.latest?.slice(0, 16).replace("T", " ")}</div></Link></li>)}</ul> : <Empty>No reports generated yet.</Empty>}</section>
        <section><h2 className="font-medium mb-2">Recent agent activity</h2>
          {convs.length ? <ul className="card divide-y divide-border">{convs.map((c) => <li key={c.id}><Link className="block p-3 text-sm hover:bg-bg" href={`/conversations/${c.id}`}>{c.title}<div className="text-xs text-muted">{c.agent} · {c.updated_at.slice(0, 16).replace("T", " ")}</div></Link></li>)}</ul> : <Empty>No conversations yet.</Empty>}</section>
        <section><h2 className="font-medium mb-2">Upcoming compliance dates</h2>
          {compliance.length ? <ul className="card divide-y divide-border">{compliance.map((c) => <li key={c.id} className="p-3 text-sm">{c.title}<div className="text-xs text-muted">{c.status} · due {c.due || "not set"}</div></li>)}</ul> : <Empty>No compliance items recorded in records/compliance. Ask the Company Secretary to propose entries.</Empty>}</section>
        <section><h2 className="font-medium mb-2">Important risks</h2>
          {risks.length ? <ul className="card divide-y divide-border">{risks.map((c) => <li key={c.id} className="p-3 text-sm">{c.title}<div className="text-xs text-muted">{c.status}</div></li>)}</ul> : <Empty>No open risks recorded in records/risks.</Empty>}</section>
      </div>
      <section><h2 className="font-medium mb-2">Company facts status</h2>
        {facts.length ? <ul className="card divide-y divide-border text-sm">{facts.map((f) => <li key={f.file} className="p-3 flex justify-between"><span>{f.file}</span><span className={f.verified ? "text-good" : "text-warn"}>{f.verified ? "verified_on set" : f.unverified ? "contains TBD/UNVERIFIED" : "no verification date"}</span></li>)}</ul> : <Empty>No fact files found.</Empty>}
        <p className="text-xs text-muted mt-2">Product development updates and financial observations appear here only once recorded in reports or facts; none are invented.</p></section>
    </div>
  );
}
