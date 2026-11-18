import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/** Resolve `target` and ensure it is inside one of `roots` (symlinks resolved). Returns real path or null. */
export function safeResolve(target: string, roots: string[]): string | null {
  if (!target || target.includes("\0")) return null;
  let real: string;
  try {
    real = fs.realpathSync(path.resolve(target));
  } catch {
    return null;
  }
  for (const r of roots) {
    let rr: string;
    try {
      rr = fs.realpathSync(r);
    } catch {
      continue;
    }
    if (real === rr || real.startsWith(rr + path.sep)) return real;
  }
  return null;
}

const SECRET_NAME = /(^\.env|\.pem$|\.key$|\.p12$|credentials|id_rsa|id_ed25519|\.npmrc$)/i;
export const isSecretFile = (p: string) => SECRET_NAME.test(path.basename(p));

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** Reject cross-origin / non-local requests (CSRF + DNS rebinding). Returns an error string or null. */
export function checkRequest(method: string, headers: { get(name: string): string | null }): string | null {
  const host = (headers.get("host") ?? "").replace(/:\d+$/, "");
  if (!LOCAL_HOSTS.includes(host)) return "Bad host";
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return null;
  const origin = headers.get("origin");
  if (!origin) return "Missing Origin";
  try {
    if (!LOCAL_HOSTS.includes(new URL(origin).hostname === "::1" ? "[::1]" : new URL(origin).hostname)) return "Cross-origin request blocked";
  } catch {
    return "Bad Origin";
  }
  const ct = headers.get("content-type") ?? "";
  if (method !== "DELETE" && !ct.includes("application/json")) return "JSON required";
  return null;
}
