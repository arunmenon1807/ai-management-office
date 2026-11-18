import { execFile, spawn } from "node:child_process";
import { claudeBin, childEnv } from "./claude.ts";
import { repoRoot } from "./paths.ts";
import { audit } from "./db.ts";

/**
 * Connector (MCP server) management through the official `claude mcp` commands. Nothing here
 * stores credentials: sign-in is OAuth in your browser, handled by Claude Code itself.
 */
export type ConnectorStatus = "connected" | "needs_auth" | "failed" | "not_configured" | "unknown";
export type Connector = {
  name: string;
  url: string;
  transport: string;
  status: ConnectorStatus;
  detail: string;
  source: "claude_ai" | "plugin" | "own";
  /** Which actions this app offers for the row. */
  can: { login: boolean; logout: boolean; remove: boolean };
};

export function parseMcpList(text: string): Connector[] {
  const out: Connector[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const i = line.lastIndexOf(" - ");
    if (!line || i < 0 || line.startsWith("Checking")) continue;
    const head = line.slice(0, i).replace(/\s+-$/, ""); // "(HTTP) - - Not configured" leaves a trailing " -"
    const tail = line.slice(i + 3).trim();
    const m = head.match(/^(.+?):\s+(https?:\S+)?(?:\s*\((\w+)\))?\s*$/);
    if (!m) continue;
    const [, name, url = "", transport = "http"] = m;
    let status: ConnectorStatus = "unknown";
    if (/Connected/i.test(tail)) status = "connected";
    else if (/Needs authentication/i.test(tail)) status = "needs_auth";
    else if (/Failed/i.test(tail)) status = "failed";
    else if (/Not configured/i.test(tail)) status = "not_configured";
    const source = name.startsWith("claude.ai ") ? "claude_ai" : name.startsWith("plugin:") ? "plugin" : "own";
    out.push({
      name, url, transport: transport.toLowerCase(), status, detail: status === "failed" ? tail.replace(/^✘\s*/, "").slice(0, 200) : "", source,
      can: { login: status === "needs_auth" || status === "failed", logout: status === "connected" && source !== "own" ? true : status === "connected", remove: source === "own" },
    });
  }
  return out;
}

let cache: { at: number; data: Connector[] } | null = null;

export function listConnectors(refresh = false): Promise<{ connectors: Connector[]; checkedAt: string; error?: string }> {
  if (!refresh && cache && Date.now() - cache.at < 60_000) return Promise.resolve({ connectors: cache.data, checkedAt: new Date(cache.at).toISOString() });
  return new Promise((resolve) => {
    execFile(claudeBin(), ["mcp", "list"], { cwd: repoRoot(), env: childEnv(), timeout: 120_000, maxBuffer: 2_000_000 }, (err, stdout) => {
      if (err && !stdout) return resolve({ connectors: cache?.data ?? [], checkedAt: new Date().toISOString(), error: "Could not run `claude mcp list`. Is Claude Code installed?" });
      const data = parseMcpList(stdout);
      cache = { at: Date.now(), data };
      resolve({ connectors: data, checkedAt: new Date().toISOString() });
    });
  });
}

const NAME_RE = /^[A-Za-z0-9 _.:@-]{1,80}$/;
export const ADD_NAME_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function validateAddUrl(u: string): string | null {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return "Only https:// addresses are allowed";
    if (url.username || url.password) return "Credentials in the address are not allowed";
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return "Local addresses are not allowed";
    return null;
  } catch { return "Not a valid address"; }
}

function run(args: string[], timeout = 60_000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(claudeBin(), args, { cwd: repoRoot(), env: childEnv(), timeout }, (err, stdout, stderr) => resolve({ ok: !err, out: (stdout + stderr).trim().slice(0, 500) }));
  });
}

/** Actions are limited to servers that exist in the current list (login/logout/remove) or a validated https URL (add). */
export async function connectorAction(a: { action: string; name?: string; url?: string }): Promise<{ ok: boolean; message: string }> {
  const name = a.name ?? "";
  if (a.action === "add") {
    if (!ADD_NAME_RE.test(name)) return { ok: false, message: "Name may use letters, numbers, - and _ (max 40)" };
    const bad = validateAddUrl(a.url ?? "");
    if (bad) return { ok: false, message: bad };
    const r = await run(["mcp", "add", "--transport", "http", "--scope", "user", name, a.url!]);
    audit("connector.add", { name, host: new URL(a.url!).hostname, ok: r.ok });
    cache = null;
    return { ok: r.ok, message: r.ok ? `Added "${name}". Click Authenticate if it needs sign-in.` : r.out };
  }
  const known = (await listConnectors(false)).connectors.find((c) => c.name === name);
  if (!NAME_RE.test(name) || !known) return { ok: false, message: "Unknown connector" };

  if (a.action === "login") {
    // Opens the browser for OAuth on this Mac. Runs detached; the founder finishes sign-in there, then refreshes.
    const child = spawn(claudeBin(), ["mcp", "login", name], { cwd: repoRoot(), env: childEnv(), stdio: "ignore", detached: true });
    child.unref();
    setTimeout(() => { try { child.kill("SIGTERM"); } catch { /* already done */ } }, 5 * 60_000).unref?.();
    audit("connector.login", { name });
    cache = null;
    return { ok: true, message: `Sign-in started for "${name}". Complete it in the browser window that opens, then press Refresh.` };
  }
  if (a.action === "logout") {
    const r = await run(["mcp", "logout", name]);
    audit("connector.logout", { name, ok: r.ok }); cache = null;
    return { ok: r.ok, message: r.ok ? `Signed out of "${name}".` : r.out };
  }
  if (a.action === "remove") {
    if (!known.can.remove) return { ok: false, message: "Only servers you added yourself can be removed here. claude.ai connectors are managed at claude.ai/settings/connectors; plugin servers through their plugin." };
    const r = await run(["mcp", "remove", name]);
    audit("connector.remove", { name, ok: r.ok }); cache = null;
    return { ok: r.ok, message: r.ok ? `Removed "${name}".` : r.out };
  }
  return { ok: false, message: "Unknown action" };
}
