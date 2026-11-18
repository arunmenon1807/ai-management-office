import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.ts";

export type AgentInfo = {
  slug: string; // value passed to `claude --agent`; "chief-of-staff" = main session (no --agent)
  name: string;
  role: string;
  description: string;
  responsibilities: string[];
  limitations: string[];
  tools: string[];
  integrations: string[];
  skills: string[];
  source: string; // file the definition was read from
  status: "ok" | "warning" | "error";
  statusNote: string;
};
export type SkillInfo = { slug: string; description: string; agents: string[]; source: string };

export function parseFrontmatter(text: string): { data: Record<string, string>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].replace(/^"(.*)"$/, "$1").trim();
  }
  return { data, body: m[2] };
}

export function section(body: string, heading: string): string {
  const re = new RegExp(`^##\\s+${heading}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "mi");
  return body.match(re)?.[1].trim() ?? "";
}
const bullets = (s: string) =>
  s.split("\n").filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, "").trim()).slice(0, 12);

// Friendly labels for MCP servers. Unknown servers fall back to their raw id (custom connectors
// may be installation specific; see docs/integration-inventory.md).
const MCP_LABELS: Record<string, string> = {
  vercel: "Vercel",
  "claude_ai_Google_Drive": "Google Drive",
  "railway": "Railway",
  "claude_ai_Gmail": "Gmail",
};
export function integrationsFromTools(tools: string[]): string[] {
  const set = new Set<string>();
  for (const t of tools) {
    const m = t.match(/^mcp__([^_].*?)__/);
    if (m) set.add(MCP_LABELS[m[1]] ?? `MCP:${m[1]}`);
    if (t === "Bash") set.add("Shell (read-only, guarded)");
    if (t === "WebSearch" || t === "WebFetch") set.add("Web");
  }
  return [...set];
}

export function listSkills(root = repoRoot()): SkillInfo[] {
  const dir = path.join(root, ".claude", "skills");
  if (!fs.existsSync(dir)) return [];
  const out: SkillInfo[] = [];
  for (const d of fs.readdirSync(dir)) {
    const f = path.join(dir, d, "SKILL.md");
    if (!fs.existsSync(f)) continue;
    const { data, body } = parseFrontmatter(fs.readFileSync(f, "utf8"));
    out.push({
      slug: data.name || d,
      description: data.description || "",
      agents: bullets(section(body, "Relevant agents")).map((b) => b.replace(/[`*]/g, "").split(/[ :(—-]/)[0]),
      source: path.relative(root, f),
    });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

export function listAgents(root = repoRoot()): AgentInfo[] {
  const skills = listSkills(root);
  const out: AgentInfo[] = [];
  const claudeMd = path.join(root, "CLAUDE.md");
  out.push({
    slug: "chief-of-staff",
    name: "Chief of Staff",
    role: "Default management agent (main session)",
    description:
      "Interprets your question, delegates to the smallest set of specialists, reconciles conflicts and consolidates a recommendation. Defined by CLAUDE.md.",
    responsibilities: [
      "Select and brief relevant specialists",
      "Check conflicts between specialists",
      "Consolidate one recommendation and list decisions needing your approval",
    ],
    limitations: ["Advisory and read-only; the guard hook blocks sends, pushes, deploys and deletes"],
    tools: ["(all tools allowed by project permissions)", "Agent (delegation)"],
    integrations: ["Delegates to specialists"],
    skills: skills.map((s) => s.slug),
    source: "CLAUDE.md",
    status: fs.existsSync(claudeMd) ? "ok" : "error",
    statusNote: fs.existsSync(claudeMd) ? "Definition file found. Runtime not verified here." : "CLAUDE.md is missing.",
  });
  const dir = path.join(root, ".claude", "agents");
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md")).sort()) {
      const full = path.join(dir, f);
      const { data, body } = parseFrontmatter(fs.readFileSync(full, "utf8"));
      const slug = data.name || f.replace(/\.md$/, "");
      const tools = (data.tools || "").split(",").map((t) => t.trim()).filter(Boolean);
      const title = body.match(/^#\s+(.+)$/m)?.[1] ?? slug;
      const problems: string[] = [];
      if (!data.name) problems.push("missing name");
      if (!data.description) problems.push("missing description");
      if (!tools.length) problems.push("no tools listed");
      out.push({
        slug,
        name: title.split(/\s+&\s+/)[0].replace(/ Advisor$/, "") === title ? title : title,
        role: (data.description || "").split(".")[0],
        description: data.description || "",
        responsibilities: bullets(section(body, "Responsibilities")),
        limitations: bullets(section(body, "Hard limits")).concat(bullets(section(body, "Boundaries"))).slice(0, 10),
        tools,
        integrations: integrationsFromTools(tools),
        skills: skills.filter((s) => s.agents.includes(slug)).map((s) => s.slug),
        source: path.relative(root, full),
        status: problems.length ? "error" : "ok",
        statusNote: problems.length ? `Misconfigured: ${problems.join(", ")}` : "Definition valid. Runtime not verified here.",
      });
    }
  }
  return out;
}

/**
 * Read-only connector tools to pre-approve for app chats (which run in dontAsk mode, so anything
 * not listed is denied). Source of truth: the agents' own `tools:` lists, filtered with the SAME
 * read/secret name rules the guard hook uses (.claude/guard-policy.json). Write-style tools
 * (create/update/trash/share/deploy/set-variables...) never match and stay denied.
 */
export function readOnlyMcpTools(root = repoRoot()): string[] {
  let readRx = /^(get|list|search|find|read|describe|whoami|status|fetch|check|count|aggregate|query)([-_]|$)/i;
  let secretRx = /(credential|secret|token|_env|envs|variables|api[-_]?keys?|sdk[-_]?keys?|bypass|signing|password|access_to)/i;
  try {
    const p = JSON.parse(fs.readFileSync(path.join(root, ".claude", "guard-policy.json"), "utf8"));
    readRx = new RegExp(p.mcp_read_name_pattern, "i");
    secretRx = new RegExp(p.mcp_secret_name_pattern, "i");
  } catch { /* fall back to the defaults above */ }
  const out = new Set<string>();
  for (const a of listAgents(root)) {
    for (const t of a.tools) {
      const m = t.match(/^mcp__(.+?)__(.+)$/);
      if (m && readRx.test(m[2]) && !secretRx.test(m[2])) {
        out.add(t);
        // The main (Chief of Staff) session sees claude.ai connectors as mcp__claude_ai_<Name>__<tool>;
        // specialists see the installation-specific names above. Approve the same read tools under both.
        const label = MCP_LABELS[m[1]];
        if (label) out.add(`mcp__claude_ai_${label.replace(/\s+/g, "_")}__${m[2]}`);
      }
    }
  }
  return [...out].sort();
}

export const getAgent =(slug: string) => listAgents().find((a) => a.slug === slug);
