import { ok, fail, body, isResp } from "@/lib/http";
import { updateTask, validateTask, type TaskInput } from "@/lib/store";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await body<TaskInput>(req);
  if (isResp(b)) return b;
  const err = validateTask(b, true);
  if (err) return fail(err);
  const t = updateTask(id, b);
  return t ? ok(t) : fail("Not found", 404);
}
