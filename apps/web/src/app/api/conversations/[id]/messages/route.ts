import { fail, body, isResp, str } from "@/lib/http";
import { getConversation } from "@/lib/store";
import { startJob, streamJob, isRunning } from "@/lib/jobs";
import { loadAttachment, MAX_FILES_PER_MESSAGE, type Attachment } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const maxDuration = 600;
type Ctx = { params: Promise<{ id: string }> };

/**
 * Starts a chat turn as a background job and streams its events as NDJSON.
 * The job keeps running if the page is closed; re-attach with GET .../stream.
 * `attachments` are paths returned by the attachments route; they are re-checked on disk here.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!getConversation(id)) return fail("Not found", 404);
  const b = await body(req);
  if (isResp(b)) return b;
  const refs = Array.isArray(b.attachments) ? (b.attachments as unknown[]).filter((x): x is string => typeof x === "string") : [];
  if (refs.length > MAX_FILES_PER_MESSAGE) return fail(`At most ${MAX_FILES_PER_MESSAGE} files per message`);
  const files: Attachment[] = [];
  for (const r of refs) { const a = loadAttachment(id, r); if (!a) return fail("An attached file is missing. Attach it again."); files.push(a); }
  let prompt = str(b.prompt, 20000)?.trim();
  if (!prompt && files.length) prompt = "Please review the attached file(s): tell me what they contain, anything that needs my attention, and what you suggest next.";
  if (!prompt) return fail("Message is empty");
  if (isRunning(id)) return fail("This conversation is still answering the previous message. You can leave and come back.", 409);
  const attach = files.length ? { files, saveToDrive: b.saveToDrive === true } : undefined;
  return new Response(streamJob(startJob(id, prompt, undefined, attach)), { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
