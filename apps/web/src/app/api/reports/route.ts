import { ok, fail, body, isResp, str } from "@/lib/http";
import { listReports, saveReport, createConversation } from "@/lib/store";
import { listSkills } from "@/lib/agents";
import { generateReport } from "@/lib/chat";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function GET(req: Request) {
  const u = new URL(req.url);
  return ok(listReports(u.searchParams.get("q") || undefined, u.searchParams.get("kind") || undefined));
}

/** { skill } generates via an existing Claude Code skill; { title, content } saves a manual report. */
export async function POST(req: Request) {
  const b = await body(req);
  if (isResp(b)) return b;
  const skill = str(b.skill, 80);
  if (skill) {
    const s = listSkills().find((x) => x.slug === skill);
    if (!s) return fail("Unknown skill");
    const conv = createConversation("chief-of-staff", `Report: ${skill}`);
    const r = await generateReport(skill, conv.id, skill, `${skill} ${new Date().toISOString().slice(0, 10)}`, str(b.report_id, 80));
    return "error" in r ? fail(r.error, 502) : ok({ ...r, conversation_id: conv.id }, 201);
  }
  const title = str(b.title, 200)?.trim();
  const content = str(b.content, 500000);
  if (!title || !content) return fail("title and content are required");
  return ok(saveReport({ kind: str(b.kind, 60) || "manual", title, content, report_id: str(b.report_id, 80) }), 201);
}
