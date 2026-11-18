import { fail, body, isResp, str } from "@/lib/http";
import { getConversation, getApproval, consumeApproval, setApprovalOutcome } from "@/lib/store";
import { startJob, streamJob, isRunning } from "@/lib/jobs";
import { canonicalHash } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 600;
type Ctx = { params: Promise<{ id: string }> };

/**
 * Runs ONE founder-approved Drive file creation. The approval is consumed first (single use, exact payload),
 * then the agent is allowed to make that one create_file call; the guard hook compares the input hash.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!getConversation(id)) return fail("Not found", 404);
  const b = await body(req);
  if (isResp(b)) return b;
  const aid = str(b.approvalId, 100);
  if (!aid) return fail("approvalId required");
  const a = getApproval(aid);
  if (!a || a.kind !== "drive.create_file" || a.conversation_id !== id) return fail("No such Drive approval for this conversation", 404);
  if (isRunning(id)) return fail("This conversation is still working. Try again when it finishes.", 409);
  let parsed: { tool: string; input: Record<string, unknown> };
  try { parsed = JSON.parse(a.details); } catch { return fail("Approval payload is unreadable", 500); }
  try { consumeApproval(a.id, a.kind, a.details); } catch (e) { return fail((e as Error).message, 409); }
  const name = String(parsed.input.title ?? parsed.input.name ?? "file");
  const prompt = `The founder approved creating this Google Drive file. Make exactly ONE call to the Google Drive create_file tool yourself (do not delegate it), with exactly this input, unchanged:\n${JSON.stringify(parsed.input)}\nThen tell the founder briefly whether it succeeded, including the file name or link from the tool result. Make no other changes.`;
  const job = startJob(id, prompt, { approvalId: a.id, hash: canonicalHash(parsed.input), userNote: `Approved: save "${name}" to Google Drive.` });
  setApprovalOutcome(a.id, "started");
  return new Response(streamJob(job), { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
