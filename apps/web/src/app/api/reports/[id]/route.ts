import { ok, fail } from "@/lib/http";
import { getReport, getReportVersions } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = getReport(id);
  if (!r) return fail("Not found", 404);
  const versions = getReportVersions(id);
  if (new URL(req.url).searchParams.get("format") === "md") {
    const v = versions[0];
    return new Response(`# ${r.title}\n\n_Generated ${v.created_at} by ${r.agent ?? "manual entry"}. As of ${v.as_of}. AI-generated snapshot: re-verify before relying on it._\n\n${v.content}\n`, {
      headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${r.id}.md"` },
    });
  }
  return ok({ report: r, versions });
}
