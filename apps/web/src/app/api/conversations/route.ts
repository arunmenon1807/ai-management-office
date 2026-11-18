import { ok, fail, body, isResp, str } from "@/lib/http";
import { createConversation, listConversations } from "@/lib/store";
import { getAgent } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") || undefined;
  return ok(listConversations(q));
}
export async function POST(req: Request) {
  const b = await body(req);
  if (isResp(b)) return b;
  const agent = str(b.agent, 80) ?? "chief-of-staff";
  const a = getAgent(agent);
  if (!a) return fail("Unknown agent");
  if (a.status === "error") return fail(a.statusNote);
  return ok(createConversation(agent, str(b.title, 120) || `${a.name} conversation`), 201);
}
