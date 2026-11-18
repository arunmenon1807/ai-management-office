# Contributing

Thanks for helping. Most valuable right now: **jurisdiction packs** (see `docs/localising.md`), more read-only integrations, and guard test cases.

## Ground rules
- **No real company data.** Examples use the fictional "Acme Co". Never commit secrets, identifiers (PAN, Aadhaar, bank, tax IDs), keys, tokens or real contracts.
- **Keep the posture read-only.** New agent tools must be read tools. Any change to `.claude/guard-policy.json` or `.claude/hooks/guard.py` needs new cases in `tests/validate.py` (both an allow and a deny).
- Edit `templates/`, not the rendered `CLAUDE.md` / `company/facts/*` / `records/sources.md`. Re-render the neutral text with `python3 scripts/init_company.py --defaults --yes`.
- Before opening a PR: `python3 tests/validate.py` (0 failures) and, for web changes, `cd apps/web && npm install && npm test && npx tsc --noEmit`.

## Reporting bugs and requesting features
Use the issue templates (New issue → Bug report or Feature request). They ask for fictional examples only: never paste real company data. Record user-visible changes in `CHANGELOG.md` under **Unreleased**.

## Reporting security issues
Use the repository's private security advisory (linked on the New issue page) rather than a public issue. Include the command or tool call the guard should have blocked.
