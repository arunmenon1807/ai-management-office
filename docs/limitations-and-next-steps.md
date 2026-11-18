# Limitations and status

Re-run `python3 tests/validate.py` after any change.

## What the test suite covers
| Item | How |
|---|---|
| Agent and skill files are structurally complete (frontmatter, required sections, no write tools beyond notes, Bash only for the CTO) | `tests/validate.py` |
| Guard hook decisions for ~110 cases (repository writes, gh, hosting CLIs, curl, rm, credential reads, protected paths, secret/PAN patterns, MCP tool names for hosting, Drive, email, payments, error tracking) | `tests/validate.py` case table, run against the real `guard.py` |
| Guard fails closed on malformed input and writes a redacted audit log | `tests/validate.py` |
| Records tooling: ID sequencing, approval validation, overdue / never-verified / expired-report detection | `tests/validate.py` in a temp directory |
| Setup wizard renders every template with no unresolved tokens and refuses identifier-like input | `tests/validate.py` |
| Web app core, connectors and mocked Claude sessions | `cd apps/web && npm test` |

## What it does not cover
- Live integrations (Drive, Gmail, Vercel, Railway, GitHub) and Claude's runtime behaviour. Verify these in your own environment.
- Whether the guard hook applies inside subagents in your Claude Code version. Test it: in a scratch repository, ask an agent to push to a remote; it must be refused with "[AIMO guard]".
- Scheduling is not configured.

## Known limitations
- The regex guard is not a sandbox (see `docs/permission-model.md`). Keep Claude Code in prompting mode.
- All regulatory content is Low confidence by design. The agents do not replace your Company Secretary, Chartered Accountant or counsel.
- The CS and CA specialists default to Indian law. See `docs/localising.md` for other jurisdictions.
- The desktop launcher (`apps/launcher`) is macOS only. The web app itself is a normal Next.js app.
- Claude Code does not copy `.claude/` when a session moves folders. Copy it yourself if you move the project.

## Next steps for a new setup
1. `python3 scripts/init_company.py`, then confirm `company/facts/*` yourself.
2. Name your appointed Company Secretary, Accountant and counsel in `company/facts/identity-legal.md`.
3. Connect integrations read-only per `docs/integration-inventory.md`.
4. Run `/compliance-check` and `/financial-review` for a first baseline.
5. After two weeks of manual `/daily-brief` and `/weekly-review`, consider scheduling them read-only.
