import { ok } from "@/lib/http";
import { integrityCheck } from "@/lib/db";
import { authStatus } from "@/lib/claude";
import { listAgents } from "@/lib/agents";
import { dataDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const full = new URL(req.url).searchParams.get("full");
  const base = { status: "ok", version: "0.1.0", db: integrityCheck(), agents: listAgents().length };
  if (!full) return ok(base);
  return ok({ ...base, dataDir: dataDir(), auth: await authStatus() });
}
