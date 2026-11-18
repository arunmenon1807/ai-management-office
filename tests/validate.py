#!/usr/bin/env python3
"""Validation for the AI Management Office (stdlib only).

Run from anywhere:  python3 tests/validate.py
Checks static configuration, executes the guard hook against a case table, and
exercises the records tooling in a temp directory. It does NOT test live
integrations or Claude's runtime behaviour; see docs/limitations-and-next-steps.md.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUARD = os.path.join(ROOT, ".claude", "hooks", "guard.py")
RECORDS = os.path.join(ROOT, "scripts", "records.py")
PASS = FAIL = 0


def check(cond, msg):
    global PASS, FAIL
    if cond:
        PASS += 1
    else:
        FAIL += 1
        print("FAIL:", msg)


def frontmatter(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return None, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip().strip('"')
    return meta, m.group(2)


# ---------------------------------------------------------------- agents
AGENTS = ["company-secretary", "chartered-accountant", "cfo", "cto", "product-manager", "marketing-growth"]
AGENT_HEADINGS = ["Purpose", "Responsibilities", "Boundaries", "Delegation criteria", "Evidence policy", "Tools",
                  "Hard limits", "Standard output format", "Escalation conditions", "Company-specific use cases"]
# Write/Edit are allowed for agents ONLY to keep their own notes (company/agent-notes); see the body check below.
FORBIDDEN_AGENT_TOOLS = {"MultiEdit", "NotebookEdit", "Agent"}
for a in AGENTS:
    p = os.path.join(ROOT, ".claude", "agents", a + ".md")
    check(os.path.exists(p), "agent file missing: " + a)
    if not os.path.exists(p):
        continue
    meta, body = frontmatter(p)
    check(meta is not None, a + ": no frontmatter")
    if meta is None:
        continue
    check(meta.get("name") == a, a + ": name must equal filename")
    check(len(meta.get("description", "")) > 60, a + ": description too short for delegation matching")
    tools = [t.strip() for t in meta.get("tools", "").split(",") if t.strip()]
    check(bool(tools), a + ": tools must be restricted explicitly")
    check(not (set(tools) & FORBIDDEN_AGENT_TOOLS), a + ": has write/spawn tools")
    check(("Bash" in tools) == (a == "cto"), a + ": only the cto may have Bash")
    if "Write" in tools or "Edit" in tools:
        check("company/agent-notes/" in body, a + ": Write/Edit requires the notes-only rule in the agent body")
    for h in AGENT_HEADINGS:
        check(re.search(r"^#+ " + re.escape(h), body, re.M) is not None, "%s: missing heading '%s'" % (a, h))
    check("not a licensed or formally appointed" in body, a + ": missing professional-disclaimer line")
    check("Claim | Source" in body, a + ": evidence format missing")
    check("DRAFT" in body or "ADVISORY" in body, a + ": no advisory marker in output format")

# ---------------------------------------------------------------- skills
SKILLS = ["daily-brief", "weekly-review", "monthly-business-review", "compliance-check", "financial-review",
          "technology-review", "decision-review"]
SKILL_HEADINGS = ["When to use", "Required data sources", "Relevant agents", "Workflow", "Output format",
                  "Verification requirements", "Failure handling", "Approval requirements"]
for s in SKILLS:
    p = os.path.join(ROOT, ".claude", "skills", s, "SKILL.md")
    check(os.path.exists(p), "skill missing: " + s)
    if not os.path.exists(p):
        continue
    meta, body = frontmatter(p)
    check(meta is not None and meta.get("name") == s, s + ": frontmatter name must equal directory")
    check(meta is not None and len(meta.get("description", "")) > 40, s + ": description too short")
    for h in SKILL_HEADINGS:
        check(re.search(r"^## " + re.escape(h), body, re.M) is not None, "%s: missing section '%s'" % (s, h))
    for a in re.findall(r"`([a-z\-]+)`", body):
        if a in AGENTS or a in SKILLS:
            continue
    check(re.search(r"^1\. ", body, re.M) is not None, s + ": workflow is not numbered")

# ---------------------------------------------------------------- settings
sp = os.path.join(ROOT, ".claude", "settings.json")
check(os.path.exists(sp), "settings.json missing")
if os.path.exists(sp):
    st = json.load(open(sp))
    perms = st.get("permissions", {})
    check(perms.get("defaultMode") in (None, "default", "plan", "acceptEdits"), "defaultMode must not be bypass/auto")
    deny = " ".join(perms.get("deny", []))
    for needle in ["git push", ".env", ".ssh"]:
        check(needle in deny, "settings deny list lacks " + needle)
    all_rules = perms.get("allow", []) + perms.get("ask", []) + perms.get("deny", [])
    check(not [r for r in all_rules if r.startswith("Write(")], "use Edit(path) rules; Write(path) rules are ignored by Claude Code")
    pre = st.get("hooks", {}).get("PreToolUse", [])
    check(any("guard.py" in h.get("command", "") for e in pre for h in e.get("hooks", [])), "guard hook not wired in PreToolUse")
    check(os.path.exists(GUARD), "guard.py missing")
    ss = st.get("hooks", {}).get("SessionStart", [])
    check(any("records.py" in h.get("command", "") for e in ss for h in e.get("hooks", [])), "SessionStart staleness hook missing")

# ---------------------------------------------------------------- guard behaviour
sys.path.insert(0, os.path.join(ROOT, ".claude", "hooks"))
import guard  # noqa: E402

policy = json.load(open(os.path.join(ROOT, ".claude", "guard-policy.json")))
tmp_root = tempfile.mkdtemp(prefix="bai-root-")
VERCEL = "mcp__vercel__"
CASES = [
    # (tool, input, expected)
    ("Bash", {"command": "git status"}, "allow"),
    ("Bash", {"command": "git diff --stat"}, "allow"),
    ("Bash", {"command": "git push origin main"}, "deny"),
    ("Bash", {"command": "git push --force"}, "deny"),
    ("Bash", {"command": "git reset --hard HEAD~1"}, "deny"),
    ("Bash", {"command": "git commit -m x"}, "ask"),
    ("Bash", {"command": "gh pr list --repo o/r"}, "allow"),
    ("Bash", {"command": "gh repo view o/r"}, "allow"),
    ("Bash", {"command": "gh run list --repo o/r"}, "allow"),
    ("Bash", {"command": "gh api repos/o/r/commits"}, "allow"),
    ("Bash", {"command": "gh pr merge 12"}, "deny"),
    ("Bash", {"command": "gh issue create --title x"}, "deny"),
    ("Bash", {"command": "gh api -X POST repos/o/r/issues"}, "deny"),
    ("Bash", {"command": "gh api repos/o/r/issues -f title=x"}, "deny"),
    ("Bash", {"command": "gh auth token"}, "deny"),
    ("Bash", {"command": "vercel --prod"}, "deny"),
    ("Bash", {"command": "vercel deploy"}, "deny"),
    ("Bash", {"command": "railway up"}, "deny"),
    ("Bash", {"command": "wrangler deploy"}, "deny"),
    ("Bash", {"command": "vercel env pull"}, "deny"),
    ("Bash", {"command": "vercel"}, "deny"),
    ("Bash", {"command": "cd app && npx vercel --prod"}, "deny"),
    ("Bash", {"command": "vercel ls"}, "allow"),
    ("Bash", {"command": "git log --oneline -3 -- vercel.json"}, "allow"),
    ("Bash", {"command": "curl -X POST https://example.com -d a=b"}, "deny"),
    ("Bash", {"command": "curl --data @file https://example.com"}, "deny"),
    ("Bash", {"command": "curl -s https://example.com"}, "allow"),
    ("Bash", {"command": "rm -rf records"}, "deny"),
    ("Bash", {"command": "sudo ls"}, "deny"),
    ("Bash", {"command": "ssh host"}, "deny"),
    ("Bash", {"command": "cat .env"}, "deny"),
    ("Bash", {"command": "cat ~/.ssh/id_ed25519"}, "deny"),
    ("Bash", {"command": "cat company/private/x.txt"}, "deny"),
    ("Bash", {"command": "printenv"}, "deny"),
    ("Bash", {"command": "pip install requests"}, "ask"),
    ("Bash", {"command": "echo hi > company/facts/strategy.md"}, "ask"),
    ("Bash", {"command": "python3 scripts/records.py new decision 'x'"}, "ask"),
    ("Bash", {"command": "python3 scripts/records.py stale"}, "allow"),
    ("Bash", {"command": "echo PAN ABCDE1234F"}, "deny"),
    ("Write", {"file_path": "records/reports/r.md", "content": "hello"}, "allow"),
    ("Write", {"file_path": "records/actions/ACT-0001-x.md", "content": "hello"}, "allow"),
    ("Write", {"file_path": "company/conclusions/c.md", "content": "hello"}, "allow"),
    ("Write", {"file_path": "records/decisions/DEC-0001-x.md", "content": "hello"}, "ask"),
    ("Write", {"file_path": "company/facts/strategy.md", "content": "hello"}, "ask"),
    ("Edit", {"file_path": "CLAUDE.md", "new_string": "x"}, "ask"),
    ("Write", {"file_path": ".claude/settings.json", "content": "{}"}, "ask"),
    ("Write", {"file_path": ".claude/guard-policy.json", "content": "{}"}, "ask"),
    ("Write", {"file_path": "company/private/bank.md", "content": "x"}, "deny"),
    ("Write", {"file_path": "logs/audit.jsonl", "content": "x"}, "deny"),
    ("Write", {"file_path": ".git/config", "content": "x"}, "deny"),
    ("Write", {"file_path": "/etc/hosts", "content": "x"}, "ask"),
    ("Write", {"file_path": "../outside.md", "content": "x"}, "ask"),
    ("Write", {"file_path": "records/reports/r.md", "content": "key AKIAABCDEFGHIJKLMNOP"}, "deny"),
    ("Write", {"file_path": "records/reports/r.md", "content": "api_key = abcd1234abcd1234abcd"}, "deny"),
    ("Write", {"file_path": "records/reports/r.md", "content": "PAN ABCDE1234F"}, "deny"),
    ("Write", {"file_path": "records/reports/r.md", "content": "-----BEGIN PRIVATE KEY-----"}, "deny"),
    ("Edit", {"file_path": "records/reports/r.md", "new_string": "ghp_" + "a" * 36}, "deny"),
    ("WebFetch", {"url": "https://www.mca.gov.in", "prompt": "x"}, "allow"),
    ("WebFetch", {"url": "https://x.example/?k=sk-" + "a" * 30, "prompt": "x"}, "deny"),
    ("Read", {"file_path": "CLAUDE.md"}, "allow"),
    # MCP: read allowed, write/secret denied
    (VERCEL + "list_projects", {}, "allow"),
    (VERCEL + "get_deployment", {"idOrUrl": "x"}, "allow"),
    (VERCEL + "list_billing_charges", {}, "allow"),
    (VERCEL + "get_runtime_errors", {}, "allow"),
    (VERCEL + "create_deployment", {}, "deny"),
    (VERCEL + "request_rollback", {}, "deny"),
    (VERCEL + "request_promote", {}, "deny"),
    (VERCEL + "edit_project_env", {}, "deny"),
    (VERCEL + "get_project_env", {}, "deny"),
    (VERCEL + "filter_project_envs", {}, "deny"),
    (VERCEL + "get_shared_env_var", {}, "deny"),
    (VERCEL + "get_access_to_vercel_url", {}, "deny"),
    (VERCEL + "buy_domain", {}, "deny"),
    (VERCEL + "update_project", {}, "deny"),
    (VERCEL + "delete_sandbox", {}, "deny"),
    ("mcp__railway__list-services", {}, "allow"),
    ("mcp__railway__get-status", {}, "allow"),
    ("mcp__railway__redeploy", {}, "deny"),
    ("mcp__railway__restart-service", {}, "deny"),
    ("mcp__railway__set-variables", {}, "deny"),
    ("mcp__railway__list-variables", {}, "deny"),
    ("mcp__railway__railway-agent", {}, "deny"),
    ("mcp__railway__delete-service", {}, "deny"),
    ("mcp__claude_ai_Google_Drive__search_files", {"query": "x"}, "allow"),
    ("mcp__claude_ai_Google_Drive__read_file_content", {}, "allow"),
    ("mcp__claude_ai_Google_Drive__share_file", {}, "deny"),
    ("mcp__claude_ai_Google_Drive__trash_file", {}, "deny"),
    ("mcp__claude_ai_Google_Drive__update_file", {}, "deny"),
    ("mcp__claude_ai_Google_Drive__create_file", {}, "ask"),
    ("mcp__resend__send-email", {}, "deny"),
    ("mcp__resend__send-broadcast", {}, "deny"),
    ("mcp__resend__list-api-keys", {}, "deny"),
    ("mcp__payments__send_invoice", {}, "deny"),
    ("mcp__payments__create_payment_link", {}, "deny"),
    ("mcp__payments__list_transactions", {}, "allow"),
    ("mcp__sentry__update_issue", {}, "deny"),
    ("mcp__sentry__search_issues", {}, "allow"),
    ("mcp__claude_ai_Gmail__search_threads", {"query": "invoice"}, "allow"),
    ("mcp__claude_ai_Gmail__get_thread", {}, "allow"),
    ("mcp__claude_ai_Gmail__get_message", {}, "allow"),
    ("mcp__claude_ai_Gmail__list_drafts", {}, "allow"),
    ("mcp__claude_ai_Gmail__create_draft", {"to": ["a@example.com"], "body": "Hello"}, "allow"),
    ("mcp__claude_ai_Gmail__update_draft", {"body": "Hello again"}, "allow"),
    ("mcp__claude_ai_Gmail__create_draft", {"body": "Hello"}, "allow"),
    ("mcp__claude_ai_Gmail__create_draft", {"body": "PAN " + "ABCDE" + "1234F"}, "deny"),
    ("mcp__claude_ai_Gmail__send_message", {}, "deny"),
    ("mcp__claude_ai_Gmail__reply", {}, "deny"),
    ("mcp__claude_ai_Gmail__forward", {}, "deny"),
    ("mcp__claude_ai_Gmail__delete_draft", {}, "deny"),
    ("mcp__claude_ai_Gmail__trash_thread", {}, "deny"),
    ("mcp__claude_ai_Gmail__label_thread", {}, "deny"),
    ("mcp__claude_ai_Gmail__mark_thread_spam", {}, "deny"),
    ("mcp__claude-in-chrome__navigate", {}, "ask"),
    ("mcp__computer-use__app_click", {}, "ask"),
    ("mcp__ccd_session__list_start_targets", {}, "allow"),
    ("mcp__unknownvendor__do_thing", {}, "deny"),
]
for tool, inp, expected in CASES:
    got, reason = guard.evaluate({"tool_name": tool, "tool_input": inp}, policy, tmp_root)
    check(got == expected, "guard %s %s -> %s (expected %s) %s" % (tool.split("__")[-1], json.dumps(inp)[:60], got, expected, reason))

# end-to-end hook protocol and fail-closed behaviour
env = dict(os.environ, CLAUDE_PROJECT_DIR=tmp_root)
r = subprocess.run([sys.executable, GUARD], input=json.dumps({"tool_name": "Bash", "tool_input": {"command": "git push"}}),
                   capture_output=True, text=True, env=env)
out = json.loads(r.stdout or "{}")
check(r.returncode == 0 and out.get("hookSpecificOutput", {}).get("permissionDecision") == "deny", "e2e: git push not denied")
r = subprocess.run([sys.executable, GUARD], input="not json", capture_output=True, text=True, env=env)
out = json.loads(r.stdout or "{}")
check(out.get("hookSpecificOutput", {}).get("permissionDecision") == "deny", "fail-closed: bad input must deny")
r = subprocess.run([sys.executable, GUARD], input=json.dumps({"tool_name": "Bash", "tool_input": {"command": "git status"}}),
                   capture_output=True, text=True, env=env)
check(r.returncode == 0 and r.stdout.strip() == "", "e2e: allowed call must print nothing")
audit_path = os.path.join(tmp_root, "logs", "audit.jsonl")
check(os.path.exists(audit_path) and "git push" in open(audit_path).read(), "audit log not written")
lines = [json.loads(x) for x in open(audit_path)] if os.path.exists(audit_path) else []
check(all("decision" in x and "ts" in x for x in lines), "audit log entries malformed")
r = subprocess.run([sys.executable, GUARD], input=json.dumps({"tool_name": "Bash", "tool_input": {"command": "echo ghp_" + "a" * 36}}),
                   capture_output=True, text=True, env=env)
check("ghp_aaaa" not in open(audit_path).read(), "audit log leaked a secret")

# ---------------------------------------------------------------- records tooling
rt = tempfile.mkdtemp(prefix="bai-rec-")
renv = dict(os.environ, RECORDS_ROOT=rt)


def rec(*args):
    return subprocess.run([sys.executable, RECORDS] + list(args), capture_output=True, text=True, env=renv)


p = rec("new", "decision", "Test decision").stdout.strip()
check(p.endswith(".md") and os.path.exists(p) and "DEC-0001" in p, "records: new decision failed")
p2 = rec("new", "decision", "Second").stdout.strip()
check("DEC-0002" in p2, "records: id sequencing failed")
check(rec("check").returncode == 0, "records: fresh proposed decision should validate")
txt = open(p).read().replace("status: proposed", "status: approved")
open(p, "w").write(txt)
check(rec("check").returncode != 0, "records: approved decision without approver must fail")
a = rec("new", "action", "Overdue action").stdout.strip()
_t = open(a).read().replace("due: ", "due: 2020-01-01")
open(a, "w").write(_t)
check("past due" in rec("stale").stdout, "records: overdue action not reported stale")
c = rec("new", "compliance", "Test obligation").stdout.strip()
check("never verified" in rec("stale").stdout, "records: unverified compliance not flagged")
os.makedirs(os.path.join(rt, "records", "reports"), exist_ok=True)
open(os.path.join(rt, "records", "reports", "old.md"), "w").write(
    "---\ntype: weekly\nas_of: 2020-01-01\nvalid_until: 2020-01-08\nstatus: snapshot\n---\nx\n")
check("report expired" in rec("stale").stdout, "records: expired report not flagged as history")
check("open" in rec("status").stdout, "records: status output")

# ---------------------------------------------------------------- repo hygiene
gi = open(os.path.join(ROOT, ".gitignore")).read()
for needle in [".env", "company/private/*", "logs/", "*.pem"]:
    check(needle in gi, ".gitignore missing " + needle)
_priv_dir = os.path.join(ROOT, "company", "private")
priv = os.listdir(_priv_dir) if os.path.isdir(_priv_dir) else []  # created by scripts/init_company.py
check(set(priv) <= {"README.md"}, "company/private must contain only README.md in the repo")

# ---------------------------------------------------------------- setup wizard
import importlib.util
_spec = importlib.util.spec_from_file_location("init_company", os.path.join(ROOT, "scripts", "init_company.py"))
ic = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ic)
_sample = ic.normalise({"company_name": "Acme | Co", "country": "Germany", "currency": "eur", "business_type": "SaaS",
                        "description": "Notes app for teams.", "fiscal_year": "Jan-Dec",
                        "products": ["AcmeApp: a notes app", {"name": "AcmeSync", "description": ""}]})
for label, prof, configured in (("sample", _sample, True), ("defaults", ic.normalise(ic.DEFAULT_PROFILE), False)):
    try:
        rendered = ic.render(prof, configured, "2026-01-01")
    except SystemExit as e:
        check(False, "wizard render failed (%s): %s" % (label, e))
        continue
    check(set(rendered) == set(ic.RENDER.values()), "wizard renders every target (%s)" % label)
    check(all("{{" not in t for t in rendered.values()), "no unresolved tokens (%s)" % label)
    for dest, t in rendered.items():
        if dest.endswith(".md") and "company/facts" in dest:
            widths = {l.count("|") for l in t.splitlines() if l.startswith("|") and not l.startswith("|---")}
            for blk in t.split("\n\n"):
                ws = {l.count("|") for l in blk.splitlines() if l.startswith("|")}
                check(len(ws) <= 1, "table column mismatch in %s (%s)" % (dest, label))
_r = ic.render(_sample, True, "2026-01-01")
check("Acme / Co" in _r["CLAUDE.md"] and "Germany" in _r["CLAUDE.md"] and "EUR" in _r["CLAUDE.md"], "wizard puts company context into CLAUDE.md")
check("AcmeSync" in _r["company/facts/products.md"] and "AcmeSync" in _r["company/facts/technical-architecture.md"], "wizard renders product rows")
check("lakh" not in _r["CLAUDE.md"], "Indian numbering note only for INR")
check(ic.check_sensitive(ic.normalise({"company_name": "X", "description": "PAN " + "ABCDE" + "1234F"})) != [], "wizard refuses PAN-like input")
check(ic.check_sensitive(ic.normalise({"company_name": "X", "description": "acct 123456789012"})) != [], "wizard refuses long digit runs")
check(os.path.exists(os.path.join(ROOT, "templates", "CLAUDE.md.tmpl")), "templates/CLAUDE.md.tmpl missing")

secret_rx = [re.compile(x["pattern"], re.I) for x in policy["secret_content_patterns"] if "PAN" not in x["reason"] and "Aadhaar" not in x["reason"]]
leaks = []
for dp, dn, fn in os.walk(ROOT):
    dn[:] = [d for d in dn if d not in (".git", "logs", "__pycache__", "node_modules", ".next")]
    for f in fn:
        fp = os.path.join(dp, f)
        if fp == os.path.abspath(__file__) or f == "guard-policy.json":
            continue
        try:
            t = open(fp, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        for rx_ in secret_rx:
            if rx_.search(t):
                leaks.append(os.path.relpath(fp, ROOT))
check(not leaks, "possible secrets in repo files: %s" % sorted(set(leaks)))

for doc in ["architecture", "setup", "agent-responsibility-matrix", "integration-inventory", "permission-model",
            "operating-guide", "records-and-freshness", "example-workflows", "limitations-and-next-steps"]:
    check(os.path.exists(os.path.join(ROOT, "docs", doc + ".md")), "doc missing: " + doc)
check(os.path.exists(os.path.join(ROOT, "examples", "mock-decision-workflow", "README.md")), "mock example missing")
for f in os.listdir(os.path.join(ROOT, "examples", "mock-decision-workflow")) if os.path.isdir(os.path.join(ROOT, "examples", "mock-decision-workflow")) else []:
    t = open(os.path.join(ROOT, "examples", "mock-decision-workflow", f)).read()
    check("MOCK" in t, "mock example file not labelled MOCK: " + f)

print("\n%d passed, %d failed" % (PASS, FAIL))
sys.exit(1 if FAIL else 0)
