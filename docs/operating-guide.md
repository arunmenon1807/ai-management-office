# Operating guide

## Daily rhythm
| When | Command | Result |
|---|---|---|
| Morning | `/daily-brief` | One-screen brief: decisions today, due items, anomalies |
| Friday | `/weekly-review` | Progress, risks, conflicts, next week |
| First week of month | `/monthly-business-review` | Scorecard across all functions |
| Monthly / event | `/compliance-check` | Obligation register status and what the CS/CA must confirm |
| Monthly / before spend | `/financial-review` | Cash, runway, run-rate, scenarios |
| Quarterly / pre-launch | `/technology-review` | Architecture, infra, risks, cost |
| Any material choice | `/decision-review <question>` | Decision brief, approval, record |

You can also ask ad hoc: "Ask the CFO whether we can afford X". The Chief of Staff picks the smallest set of specialists.

## How you approve
Specialists propose; you approve in chat. The Chief of Staff records only what you explicitly approve. Writing a decision record triggers a Claude Code prompt as a second check. External steps (filing, paying, deploying, emailing, pushing code) are always yours or your professionals'.

## Reading outputs
- Every material claim has Source, Verified on, Confidence, Basis. Treat Low as a lead, not a fact.
- `UNVERIFIED` means the source was unavailable or missing. Fix the source or decide knowingly.
- `Unknown` status means no verified data, not "fine".
- Reports end with their `valid_until`. After that date they are history.

## Routine upkeep
1. Weekly: skim `python3 scripts/records.py stale`.
2. Monthly: refresh `last_verified` on compliance entries after re-reading sources.
3. Quarterly: re-confirm `company/facts/` and `records/sources.md`; review `logs/audit.jsonl` for denied/asked calls; run `python3 tests/validate.py`.
4. After any change to `.claude/`, `CLAUDE.md` or the policy: run validation, commit.

## When something is blocked
The guard message explains why. Do not ask Claude to find a workaround. Either perform the action yourself, or change the policy deliberately (see permission model).

## Roles of the appointed professionals
The agents prepare questions, checklists and drafts. Your Company Secretary, Chartered Accountant and counsel confirm and act on statutory, tax and legal matters.
