import { execFile } from "node:child_process";
import { ok, fail, body, isResp, str } from "@/lib/http";
import { listDir, readDoc, searchDocs, approvedRoots } from "@/lib/documents";
import { safeResolve, isSecretFile } from "@/lib/security";
import { audit } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get("q");
  if (q) return ok(searchDocs(q.slice(0, 100)));
  const p = u.searchParams.get("path");
  if (u.searchParams.get("read") && p) {
    const r = readDoc(p);
    return "error" in r ? fail(r.error, 403) : ok(r);
  }
  const r = listDir(p);
  return "error" in r ? fail(r.error, 403) : ok(r);
}

/** Opens an approved file in the macOS default viewer (read-only launch; never modifies it). */
export async function POST(req: Request) {
  const b = await body(req);
  if (isResp(b)) return b;
  const real = safeResolve(str(b.path, 2000) ?? "", approvedRoots());
  if (!real || isSecretFile(real)) return fail("Path is outside the approved folders", 403);
  audit("document.open", { path: real });
  execFile("open", ["--", real], () => {});
  return ok({ ok: true });
}
