import { ok, fail, body, isResp, str } from "@/lib/http";
import { listConnectors, connectorAction } from "@/lib/connectors";

export const dynamic = "force-dynamic";
export const maxDuration = 150;

export async function GET(req: Request) {
  return ok(await listConnectors(new URL(req.url).searchParams.get("refresh") === "1"));
}

/** { action: login|logout|remove|add, name, url? }. The UI asks for confirmation before calling this. */
export async function POST(req: Request) {
  const b = await body(req);
  if (isResp(b)) return b;
  const r = await connectorAction({ action: str(b.action, 20) ?? "", name: str(b.name, 100), url: str(b.url, 500) });
  return r.ok ? ok(r) : fail(r.message);
}
