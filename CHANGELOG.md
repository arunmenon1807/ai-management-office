# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Pull request template and a Code of Conduct (adapted from Contributor Covenant 2.1).
- Community guide for GitHub Discussions (`docs/community.md`) with discussion forms for Q&A, Ideas and Show and tell.
- Repository rulesets as JSON (`.github/rulesets/`): protect `main` and `v*` release tags.

## [0.1.0] - 2026-11-18

First open-source release.

### Added
- Chief of Staff (`CLAUDE.md`) with six specialists (Company Secretary, Chartered Accountant, CFO, CTO, Product Manager, Marketing & Growth) and seven workflows (`/daily-brief`, `/weekly-review`, `/monthly-business-review`, `/compliance-check`, `/financial-review`, `/technology-review`, `/decision-review`).
- Approval guard (`.claude/hooks/guard.py`, `.claude/guard-policy.json`): advisory and read-only by default; blocks pushes, deploys, sends, secret reads and identifier-like content.
- Setup wizard `scripts/init_company.py`: name your company and give it context; renders `CLAUDE.md`, `company/facts/` and `records/sources.md` from `templates/`; refuses secrets and identifiers.
- Records tooling (`scripts/records.py`) for decisions, actions, risks, compliance items and dated reports.
- Optional local web app (Next.js) with dashboard, AI team, live office view, conversations, tasks, approvals, reports and connector health. The sidebar and page title show your company name. macOS launcher in `apps/launcher/`.
- Documentation: setup, operating guide, architecture, permission model, app guide, integration inventory, and `docs/localising.md` for other countries.
- README with intro GIF, dashboard screenshot, run-the-UI guide and a guide to connecting Google Drive, Gmail and other connectors or plugins.
- GitHub Actions: `tests/validate.py`, plus web type-check and tests on Node 24.
- MIT license.
- Issue templates (bug report, feature request) with a security-advisory contact link, and this changelog.

### Known limitations
- Company Secretary and Chartered Accountant specialists default to Indian law; other jurisdictions need adaptation (see `docs/localising.md`).
- The regex guard is not a sandbox (see `docs/permission-model.md`).
- The desktop launcher is macOS only.

[Unreleased]: https://github.com/arunmenon1807/ai-management-office/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/arunmenon1807/ai-management-office/releases/tag/v0.1.0
