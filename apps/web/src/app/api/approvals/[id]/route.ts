import { ok, fail, body, isResp, str } from "@/lib/http";
import { decideApproval } from "@/lib/store";

/** Records the founder's decision. Approving does NOT execute anything: v0.1 has no external executors. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await body(req);
  if (isResp(b)) return b;
  if (b.decision !== "approved" && b.decision !== "rejected") return fail("decision must be approved or rejected");
  try {
    decideApproval(id, b.decision, str(b.note, 1000));
    return ok({ ok: true });
  } catch (e) {
    return fail((e as Error).message, 409);
  }
}
