---
name: financial-review
description: "Review finances: cash and runway, budget vs actual, cost run-rate (AI, cloud, tools), unit economics, tax calendar impact, and recommendations."
---

# /financial-review

Run as the Chief of Staff (main session). Follow CLAUDE.md principles: advisory, read-only, evidence-labelled, founder approves.

## When to use
Monthly (inside the MBR), before spend or pricing decisions, or when costs or cash look off.

## Required data sources
- `company/facts/financial-assumptions.md`
- Drive finance sheets/docs listed in `records/sources.md` (read-only)
- Vercel billing charges (read-only connector)
- AI provider usage/billing, Railway, Cloudflare: founder-supplied export or dashboard figures (no connector verified)
- `records/risks`, `records/compliance` (tax dates)

Check availability first (see `docs/integration-inventory.md`). Do not assume any source is connected or authenticated.

## Relevant agents
`cfo` (lead), `chartered-accountant` (tax and bookkeeping angle). `cto` only for infrastructure cost drivers.

## Workflow
1. Define period and currency basis (INR, tax-inclusive or not). Gather data; record what is missing.
2. Delegate: cfo for cash, runway, budget vs actual, unit economics, scenarios; chartered-accountant for tax impact and bookkeeping hygiene; cto for cost drivers if a hotspot appears.
3. Cross-check numbers across sources (billing vs books vs bank summaries); report discrepancies rather than reconciling silently.
4. Conflict check: growth or hiring plans vs runway; tax liabilities vs cash.
5. Consolidate recommendation, thresholds breached, decisions needed.
6. After approval, record decisions/actions and save `records/reports/YYYY-MM-DD-financial-review.md` (`valid_until` = 31 days).

## Output format
```
FINANCIAL REVIEW - <period> (snapshot, valid until <date>)
Headline and recommendation
Key numbers: Metric | Value | Currency/period/tax basis | Source | Verified on | Confidence
Cash and runway (base/downside/upside, assumptions listed)
Cost run-rate by vendor vs budget
Unit economics
Tax and compliance cash impact
Discrepancies found
Decisions for you
UNVERIFIED / missing data
```

## Verification requirements
Every number cites source and read date; projections are labelled Low with assumptions. Thresholds come from `company/facts/` or are `TBD` and flagged for the founder to set.
Every material finding uses `Claim | Source | Verified on | Confidence | Basis`. Output is a dated snapshot: include `as_of` and `valid_until`.

## Failure handling
If a source is unavailable, continue with the rest, label dependent sections `UNVERIFIED - <source> unavailable`, and list the setup step from `docs/integration-inventory.md`. Never fill gaps with guesses. If a specialist returns no sources, send it back once, then mark its findings UNVERIFIED. Without finance data, output the data-request list and stop; do not model from guesses.

## Approval requirements
Read-only. No payments, invoice sending, refunds, payment links, subscription changes or transfers. Spend or pricing decisions need founder approval and a decision record.
