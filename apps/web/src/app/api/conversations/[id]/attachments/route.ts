import { fail, ok, body, isResp, str } from "@/lib/http";
import { getConversation } from "@/lib/store";
import { audit } from "@/lib/db";
import { saveUpload, removeUpload, MAX_FILE_BYTES } from "@/lib/uploads";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Save one attached file (JSON with base64 data: the app only accepts same-origin JSON for writes). */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!getConversation(id)) return fail("Not found", 404);
  const b = await body(req);
  if (isResp(b)) return b;
  const name = str(b.name, 200); const data = str(b.data, Math.ceil(MAX_FILE_BYTES * 1.4) + 10);
  if (!name || !data) return fail("name and data are required");
  try {
    const a = saveUpload(id, name, Buffer.from(data, "base64"));
    audit("chat.attach", { conversation: id, name: a.name, size: a.size });
    return ok({ name: a.name, path: a.path, size: a.size, mime: a.mime, readable: !!a.textPath || /^(text\/|application\/(json|pdf)|image\/)/.test(a.mime) });
  } catch (e) { return fail((e as Error).message); }
}

/** Remove a file that was attached but not yet sent. */
export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const p = new URL(req.url).searchParams.get("path") ?? "";
  return removeUpload(id, p) ? ok({ ok: true }) : fail("File not found", 404);
}
