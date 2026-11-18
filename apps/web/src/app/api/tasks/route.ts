import { ok, fail, body, isResp } from "@/lib/http";
import { createTask, listTasks, validateTask, type TaskInput } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(listTasks());
}
export async function POST(req: Request) {
  const b = await body<TaskInput>(req);
  if (isResp(b)) return b;
  const err = validateTask(b);
  if (err) return fail(err);
  return ok(createTask(b), 201);
}
