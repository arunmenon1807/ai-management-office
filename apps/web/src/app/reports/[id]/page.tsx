import { notFound } from "next/navigation";
import Link from "next/link";
import { getReport, getReportVersions } from "@/lib/store";
import { Md, CopyButton } from "@/components/Md";
import { GenerateReport } from "@/components/Actions";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const { v } = await searchParams;
  const r = getReport(id);
  if (!r) notFound();
  const versions = getReportVersions(id);
  const cur = versions.find((x) => String(x.version) === v) ?? versions[0];
  const sources: string[] = cur?.sources ? JSON.parse(cur.sources) : [];
  const age = cur ? Math.floor((Date.now() - Date.parse(cur.created_at)) / 86400000) : 0;
  return (
    <div className="space-y-4">
      <Link href="/reports" className="text-xs text-muted">← Reports</Link>
      <header className="flex flex-wrap justify-between gap-3">
        <div><h1 className="text-xl font-semibold">{r.title}</h1>
          <p className="text-xs text-muted">Version {cur?.version} of {versions.length} · generated {cur?.created_at.slice(0, 16).replace("T", " ")} by {r.agent ?? "manual entry"} · as of {cur?.as_of}</p></div>
        <div className="flex gap-2 flex-wrap"><a className="btn" href={`/api/reports/${id}?format=md`}>Export Markdown</a>{cur && <CopyButton text={cur.content} />}
          {r.kind && !["manual"].includes(r.kind) && <GenerateReport skill={r.kind} reportId={id} label="New version" />}</div>
      </header>
      {age > 0 && <p className="card border-warn p-3 text-sm" role="status">This report is {age} day(s) old. It is a snapshot; re-verify against live sources before relying on it.</p>}
      <div className="card p-5">{cur && <Md>{cur.content}</Md>}</div>
      <section><h2 className="font-medium text-sm mb-1">Source references mentioned in the report</h2>
        {sources.length ? <ul className="text-xs text-muted break-all">{sources.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="text-xs text-muted">None detected. Treat the content as unsourced.</p>}</section>
      {versions.length > 1 && <section><h2 className="font-medium text-sm mb-1">Versions</h2>
        <ul className="text-sm">{versions.map((x) => <li key={x.id}><Link className="text-accent underline" href={`/reports/${id}?v=${x.version}`}>v{x.version}</Link> <span className="text-muted text-xs">{x.created_at.slice(0, 16).replace("T", " ")}</span></li>)}</ul></section>}
    </div>
  );
}
