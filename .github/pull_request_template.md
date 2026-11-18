## What and why
<!-- One or two sentences. Link the issue if there is one. -->

## Type
- [ ] Bug fix
- [ ] New feature / integration / jurisdiction pack
- [ ] Docs
- [ ] Other

## Checks
- [ ] `python3 tests/validate.py` shows 0 failures
- [ ] Web changes only: `cd apps/web && npm test && npm run typecheck` pass
- [ ] Changed `.claude/guard-policy.json` or `.claude/hooks/guard.py`? I added both an allow case and a deny case to `tests/validate.py`
- [ ] New agent tools are **read-only**; anything that writes keeps a human approval step
- [ ] Edited `templates/` rather than rendered files (`CLAUDE.md`, `company/facts/*`, `records/sources.md`), and re-rendered with `python3 scripts/init_company.py --defaults --yes` if needed
- [ ] Added a line under **Unreleased** in `CHANGELOG.md` for user-visible changes

## Privacy
- [ ] This PR contains **no real company data**, secrets, tokens, tax or bank identifiers, or screenshots of a real company. Examples use the fictional "Acme Co".
