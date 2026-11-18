# AI Management Office

An advisory, **read-only-by-default** multi-agent management office for a small company, built on [Claude Code](https://claude.com/claude-code) native features. Your main Claude session acts as **Chief of Staff** and delegates to six specialists (Company Secretary, Chartered Accountant, CFO, CTO, Product Manager, Marketing & Growth) using seven standard workflows (`/daily-brief`, `/weekly-review`, `/monthly-business-review`, `/compliance-check`, `/financial-review`, `/technology-review`, `/decision-review`).

You name your company and describe it once; every agent then works from that context. A guard hook keeps the AI from sending, filing, paying, deploying, pushing or deleting: it drafts and recommends, **you** decide and act. An optional local web app (Next.js) gives a dashboard, chat, tasks, approvals and reports.

> **Not professional advice.** The specialists give decision support, not legal, tax, audit or financial advice. Statutory matters are confirmed by your appointed professionals. Regulatory content defaults to **India** (GST, ROC/MCA, TDS); see [docs/localising.md](docs/localising.md) for other jurisdictions.

## Quick start

```bash
git clone <your-copy-of-this-repo> my-office && cd my-office
python3 scripts/init_company.py        # asks for company name, country, currency, products, context
python3 tests/validate.py              # must show 0 failures
```

Then open the folder in Claude Code and read [docs/setup.md](docs/setup.md). The wizard writes `company/profile.json` and renders `CLAUDE.md` and `company/facts/` from `templates/`. Non-interactive use:

```bash
python3 scripts/init_company.py --name "Acme Co" --country India --currency INR --product "AcmeApp: a notes app" --yes
```

**Privacy:** once configured, this repo describes your company. Keep it in a **private** repository. Never commit secrets or identifiers; sensitive records go in `company/private/` (git-ignored).

## What is where

| Path | What |
|---|---|
| `CLAUDE.md` | Chief of Staff instructions + your company context (generated from `templates/CLAUDE.md.tmpl`) |
| `company/profile.json` | Your answers from the wizard |
| `company/facts/` | Founder-confirmed facts (authoritative layer) |
| `.claude/agents/`, `.claude/skills/` | The six specialists and seven workflows |
| `.claude/hooks/guard.py`, `.claude/guard-policy.json` | The approval guard |
| `records/` | Decisions, actions, risks, compliance, reports (`scripts/records.py`) |
| `apps/web/` | Optional local web app. macOS launcher in `apps/launcher/` |
| `docs/` | Setup, operating guide, architecture, permission model |
| `examples/` | A clearly-fictional (MOCK) decision workflow |

Verified vs not verified: [docs/limitations-and-next-steps.md](docs/limitations-and-next-steps.md). Contributing: [CONTRIBUTING.md](CONTRIBUTING.md). License: MIT.
