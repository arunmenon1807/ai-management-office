import { ok } from "@/lib/http";
import { getJob, streamJob, stopJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 600;
type Ctx = { params: Promise<{ id: string }> };

/** Re-attach to a running (or just-finished) turn. 204 when nothing is running. */
export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const job = getJob(id);
  if (!job || job.done) return new Response(null, { status: 204 });
  return new Response(streamJob(job), { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}

/** Explicit Stop button: the only thing that cancels a running turn. */
export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  return ok({ stopped: stopJob(id) });
}
