import { ok } from "@/lib/http";
import { listJobs } from "@/lib/jobs";
import { getConversation } from "@/lib/store";
import { listAgents } from "@/lib/agents";
import { deriveActivity } from "@/lib/office";

export const dynamic = "force-dynamic";

/** The team roster plus what the running chats are doing right now (read-only, from in-memory job events). */
export async function GET() {
  const jobs = listJobs().flatMap((j) => { const c = getConversation(j.cid); return c ? [{ agent: c.agent, done: j.done, events: j.events as Record<string, unknown>[] }] : []; });
  const roster = listAgents().filter((a) => a.status !== "error").map((a) => ({ slug: a.slug, name: a.name, role: a.role }));
  return ok({ roster, ...deriveActivity(jobs) });
}
