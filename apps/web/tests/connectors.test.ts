import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.AIMO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "bpo-conn-"));
const { parseMcpList, validateAddUrl, connectorAction } = await import("../src/lib/connectors.ts");

const SAMPLE = `Checking MCP server health…

claude.ai Google Drive: https://drivemcp.googleapis.com/mcp/v1 - ✔ Connected
claude.ai PayPal: https://mcp.paypal.com/mcp - ! Needs authentication
plugin:cloudflare:cloudflare: https://mcp.cloudflare.com/mcp (HTTP) - ! Needs authentication
plugin:design:gmail:  (HTTP) - - Not configured
plugin:data:definite: https://api.definite.app/v3/mcp/http (HTTP) - ✘ Failed to connect — endpoint not found
mytool: https://example.com/mcp (HTTP) - ✔ Connected
`;

test("parses real `claude mcp list` output", () => {
  const c = parseMcpList(SAMPLE);
  assert.equal(c.length, 6);
  const by = (n: string) => c.find((x) => x.name === n)!;
  assert.equal(by("claude.ai Google Drive").status, "connected");
  assert.equal(by("claude.ai Google Drive").source, "claude_ai");
  assert.equal(by("claude.ai PayPal").status, "needs_auth");
  assert.ok(by("claude.ai PayPal").can.login);
  assert.equal(by("plugin:cloudflare:cloudflare").status, "needs_auth");
  assert.equal(by("plugin:design:gmail").status, "not_configured");
  assert.equal(by("plugin:data:definite").status, "failed");
  assert.ok(by("mytool").can.remove && !by("claude.ai Google Drive").can.remove);
});

test("add-connector validation: https only, no creds, no local, no shell-ish names", async () => {
  assert.equal(validateAddUrl("https://mcp.example.com/mcp"), null);
  for (const bad of ["http://x.com/mcp", "https://u:p@x.com/mcp", "https://localhost/mcp", "file:///etc/passwd", "not a url"]) assert.ok(validateAddUrl(bad), bad);
  assert.equal((await connectorAction({ action: "add", name: "bad name; rm", url: "https://x.com/mcp" })).ok, false);
  assert.equal((await connectorAction({ action: "add", name: "ok", url: "http://x.com" })).ok, false);
  assert.equal((await connectorAction({ action: "bogus", name: "x" })).ok, false);
});
