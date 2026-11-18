# Permission model

Default posture: advisory and read-only. Three enforcement layers; the first two do not depend on the model following instructions.

## Layer 1: Claude Code permissions (`.claude/settings.json`)
- `defaultMode: default` (prompting). Never bypass/auto for this project.
- `deny`: git push, destructive git, reading `.env*`, `~/.ssh`, cloud credential files, `company/private`.
- `ask`: reading `company/private`, editing `company/facts`, `records/decisions`, `CLAUDE.md`, `.claude/`.
- `allow`: reading, and a short list of read-only commands (git status/diff/log, `gh ... list/view`, records and validation scripts).

## Layer 2: PreToolUse guard hook (`.claude/hooks/guard.py` + `guard-policy.json`)
Runs before every tool call, including subagents. Fails closed. Rules are regexes in the policy file.

| Risk area | Enforcement |
|---|---|
| External communications | Mail tools/CLI and `curl` writes denied; MCP send/compose/reply/forward denied by non-read-verb rule |
| Financial transactions | Payment/invoice/refund/payment-link MCP tools denied (non-read); domain purchase denied |
| Statutory filings | No portal connector exists. Browser/desktop control tools require an `ask`. Skills forbid filing; there is no technical filing capability to enable |
| Production deployments | `vercel/railway/wrangler` deploy-type CLI commands denied; MCP deploy/redeploy/promote/rollback denied |
| Repository changes | `git push`, `gh` writes denied; `git commit/add/merge` ask; writes to `.git/` denied |
| Official documents | Drive write/trash/share denied; `company/facts`, `records/decisions` writes ask; `company/private` writes denied; `rm -r/-f` denied |
| Confidential information | Credential files and env dumps unreadable; secret/PAN/Aadhaar patterns blocked from written files, commands, web requests; Drive `share_file` denied; secret-exposing MCP readers denied |
| Governance tamper | Edits to `.claude/`, `CLAUDE.md`, scripts, tests ask; `logs/` write denied |

Outcomes: `deny` blocks the call; `ask` forces a founder prompt; unmatched calls fall through to normal Claude Code permission behaviour.

## Layer 3: Agent tool allowlists and instructions
Specialists lack Write/Edit/Agent. Only the CTO has Bash. CLAUDE.md and agent text restate the gates; this layer is guidance and is not relied on alone.

## Audit
Every non-read call and every non-allow decision is appended to `logs/audit.jsonl` (git-ignored) with timestamp, tool, decision, reason and a redacted input summary.

## Known gaps (be honest about these)
- Regex rules are conservative but not a sandbox. A creative shell command (for example Python one-liners making HTTP calls, `osascript` variants, encoded commands) could evade pattern matching. Mitigations: keep Claude Code in prompting mode, run with the OS sandbox if available, review prompts.
- Built-in browser (`Claude_Browser`) tools are treated as internal and not blocked; use of them against third-party sites relies on the app's own site-permission prompts. Chrome and desktop control are `ask`.
- The `gh` token has broader scopes than the guard permits; the guard is the only barrier until a read-only token is issued.
- The guard cannot see inside connector semantics: a tool named with a read verb that has side effects would pass. Review new connectors' tool lists.
- Subagent hook inheritance is expected but should be confirmed in your Claude Code version (see limitations).
- Secret detection is pattern-based and can miss novel formats.
- Changing the policy is possible by editing `.claude/guard-policy.json` (which asks first). Treat approval of such prompts as a governance decision.

## Changing the policy
Edit `guard-policy.json`, add a matching row in the test table in `tests/validate.py`, run validation, commit with a message explaining the change.
