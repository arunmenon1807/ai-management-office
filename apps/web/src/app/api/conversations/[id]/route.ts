import { ok, fail, body, isResp, str } from "@/lib/http";
import { removeConversation } from "@/lib/conversations";
import { listApprovals, getConversation, getMessages, renameConversation } from "@/lib/store";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const c = getConversation(id);
  if (!c) return fail("Not found", 404);
  return ok({ conversation: c, messages: getMessages(id), driveApprovals: listApprovals().filter((a) => a.conversation_id === id && a.kind === "drive.create_file") });
}
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!getConversation(id)) return fail("Not found", 404);
  const b = await body(req);
  if (isResp(b)) return b;
  const title = str(b.title, 120)?.trim();
  if (!title) return fail("Title required");
  renameConversation(id, title);
  return ok({ ok: true });
}
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!getConversation(id)) return fail("Not found", 404);
  if (new URL(req.url).searchParams.get("confirm") !== "yes") return fail("Deletion must be confirmed", 400);
  const r = removeConversation(id);
  return r.ok ? ok({ ok: true }) : fail(r.error, r.status);
}
