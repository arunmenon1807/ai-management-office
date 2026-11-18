---
name: monthly-business-review
description: "Monthly business review across finance, product, technology, growth and compliance with a consolidated recommendation and decisions list."
---

# /monthly-business-review

Run as the Chief of Staff (main session). Follow CLAUDE.md principles: advisory, read-only, evidence-labelled, founder approves.

## When to use
Once a month (suggested first week), or before any major planning decision.

## Required data sources
- `company/facts/` (strategy, financial assumptions, products)
- All `records/` plus `records.py stale`
- Drive finance and product documents (read-only)
- Vercel billing and deployment data, Railway status, AI provider usage (founder-supplied export if no connector)
- GitHub activity (read-only)
- Last monthly report (history only)

Check availability first (see `docs/integration-inventory.md`). Do not assume any source is connected or authenticated.

## Relevant agents
`cfo`, `cto`, `product-manager`, `marketing-growth`, `chartered-accountant` and `company-secretary` for their sections. This is the one workflow where several specialists are normal, but still skip any with no evidence for the month.

## Workflow
1. Confirm period and data availability. List sources reachable vs not.
2. Delegate in parallel: cfo (financials, runway, cost), cto (tech/infra/security), product-manager (progress vs roadmap, metrics), marketing-growth (funnel/channels), chartered-accountant (tax calendar and bookkeeping hygiene), company-secretary (compliance calendar).
3. Collect and validate evidence labels; send back unsourced findings once.
4. Conflict check across functions (spend vs runway, roadmap vs capacity, tax/compliance vs launch dates). Present each side.
5. Consolidate: scorecard, top 3 risks, top 3 opportunities, recommendation, decisions requiring approval.
6. After approval, record decisions/actions/risks/compliance updates and save `records/reports/YYYY-MM-monthly-business-review.md` (`valid_until` = end of next month).

## Output format
```
MONTHLY BUSINESS REVIEW - <YYYY-MM> (snapshot, valid until <date>)
1 Executive summary and recommendation
2 Scorecard: Area | Status (G/A/R/Unknown) | Key metric | Source | Confidence
3 Finance | 4 Product | 5 Technology | 6 Growth | 7 Tax & accounts | 8 Compliance
9 Cross-functional conflicts and how resolved or escalated
10 Decisions for you (with options)
11 New actions and risks proposed
12 Verification table and UNVERIFIED list
```
Status is `Unknown` where no verified data exists; never default to Green.

## Verification requirements
Each scorecard cell cites a source or reads Unknown. Financial numbers state currency, period and tax basis. Regulatory items are Low confidence until confirmed by the appointed professional.
Every material finding uses `Claim | Source | Verified on | Confidence | Basis`. Output is a dated snapshot: include `as_of` and `valid_until`.

## Failure handling
If a source is unavailable, continue with the rest, label dependent sections `UNVERIFIED - <source> unavailable`, and list the setup step from `docs/integration-inventory.md`. Never fill gaps with guesses. If a specialist returns no sources, send it back once, then mark its findings UNVERIFIED. A section with no data appears as 'No verified data this month' with the setup step.

## Approval requirements
Founder approval needed for every decision recorded and any external step (filing, payment, deployment, communication). The review itself is read-only.
