# Setup

## 0. Name your company and give it context
```bash
python3 scripts/init_company.py
```
The wizard asks for company name, country, currency, business type, what the company does, stage, fiscal year and products. It writes `company/profile.json` and renders `CLAUDE.md` and `company/facts/`. Re-run any time; changed files are backed up to `<file>.bak`. No secrets or identifiers in any answer. If your country is not India, read `docs/localising.md`.

## 1. Open the project
Open this folder in Claude Code (CLI or desktop). Project settings, hooks, agents and skills load from `.claude/`. Hooks run only when the session's working directory is this project.

```bash
git init   # if not already a repository
python3 tests/validate.py
```
Validation must show 0 failures before you rely on the guard.

## 2. Confirm hooks are active
In Claude Code run `/hooks` (CLI) and check PreToolUse (guard) and SessionStart (staleness) appear. Then ask Claude to run `git push` in a scratch repo: it must be refused with "[AIMO guard]".

## 3. Confirm agents and skills are discovered
`claude agents` lists the six specialists. Type `/` and look for the seven skills. If one is missing, run `python3 tests/validate.py` for a structural error.

## 4. Fill authoritative facts
Edit `company/facts/*.md` yourself. Start with `identity-legal.md`, `financial-assumptions.md` (thresholds) and `products.md`. Replace `TBD` only with confirmed values and add source and date. Put sensitive documents in `company/private/` (ignored by Git) or leave them in their source system.

## 5. Register sources
Add rows to `records/sources.md` for Drive folders, GitHub repos, Vercel/Railway projects. Locators only.

## 6. Connect integrations
Follow `docs/integration-inventory.md`. Start read-only. Authenticate through each tool's own OAuth or CLI login, never by pasting credentials into chat or files.

## 7. Optional: scheduling
Scheduling (for example a weekday `/daily-brief`) is not configured. If wanted, use Claude Code scheduled tasks after reviewing the output of a manual run; scheduled runs must stay read-only and write only to `records/reports/`.

## Git
Commit the configuration, docs and records only. Never commit `company/private/`, `.env*` or `logs/` (ignored). Review changes to `.claude/` and `CLAUDE.md` like code; the guard asks before Claude edits them.
