import { ok, fail, body, isResp, str } from "@/lib/http";
import { listApprovals, requestApproval } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(listApprovals());
}
export async function POST(req: Request) {
  const b = await body(req);
  if (isResp(b)) return b;
  try {
    return ok(requestApproval({ kind: str(b.kind, 60) ?? "", title: str(b.title, 200) ?? "", details: str(b.details, 20000) ?? "", agent: str(b.agent, 80), conversation_id: str(b.conversation_id, 80) }), 201);
  } catch (e) {
    return fail((e as Error).message);
  }
}
