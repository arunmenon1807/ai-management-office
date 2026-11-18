import { ok, fail, body, isResp, str } from "@/lib/http";
import { listNotes, clearNotes } from "@/lib/notes";

export const dynamic = "force-dynamic";
export const GET = () => ok(listNotes());

/** Clears (archives) one agent's notes. Requires explicit confirmation. */
export async function POST(req: Request) {
  const b = await body(req);
  if (isResp(b)) return b;
  if (b.confirm !== "yes") return fail("Confirmation required");
  try { return ok({ cleared: clearNotes(str(b.agent, 80) ?? "") }); } catch (e) { return fail((e as Error).message); }
}
