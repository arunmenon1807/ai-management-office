import { ok, fail, body, isResp, str } from "@/lib/http";
import { getConversation, getMessages, createConversation } from "@/lib/store";
import { getAgent } from "@/lib/agents";
import { buildHandoff, type Delegation } from "@/lib/chat";
import { audit } from "@/lib/db";

/** Opens a personal chat with the specialist that worked on a delegation, carrying the context over. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = getConversation(id);
  if (!conv) return fail("Not found", 404);
  const b = await body(req);
  if (isResp(b)) return b;
  const msgs = getMessages(id);
  const idx = msgs.findIndex((m) => m.id === str(b.messageId, 80));
  if (idx < 0 || msgs[idx].role !== "assistant" || !msgs[idx].meta) return fail("Message not found");
  const d = (JSON.parse(msgs[idx].meta!).delegations as Delegation[] | undefined)?.find((x) => x.id === str(b.delegationId, 80));
  if (!d) return fail("Delegation not found");
  const agent = getAgent(d.agent);
  if (!agent || agent.status === "error") return fail(`Agent "${d.agent}" is not available`);
  const request = [...msgs.slice(0, idx)].reverse().find((m) => m.role === "user")?.content ?? "(not recorded)";
  const c = createConversation(agent.slug, `${agent.name.split(" & ")[0]} (from Chief of Staff)`, buildHandoff(request, d));
  audit("conversation.handoff", { from: id, to: c.id, agent: agent.slug });
  return ok({ id: c.id }, 201);
}
