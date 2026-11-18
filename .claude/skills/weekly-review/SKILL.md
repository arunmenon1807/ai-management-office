---
name: weekly-review
description: "Weekly founder review: progress on actions and decisions, risks, product/engineering movement, cash and spend signals, and next week's priorities."
---

# /weekly-review

Run as the Chief of Staff (main session). Follow CLAUDE.md principles: advisory, read-only, evidence-labelled, founder approves.

## When to use
End of each week (suggested Friday) or on request.

## Required data sources
- `records/actions`, `records/decisions`, `records/risks`, `records/compliance` (via `records.py list` and `stale`)
- Previous weekly report in `records/reports/` (history only; re-verify everything)
- GitHub activity (read-only): merged/open PRs, failed runs
- Vercel/Railway status and billing (read-only)
- Drive: finance/product sheets named in `records/sources.md` (read-only)

Check availability first (see `docs/integration-inventory.md`). Do not assume any source is connected or authenticated.

## Relevant agents
`cto` (engineering and infra movement, only if sources reachable), `cfo` (spend/cash signals, only if finance sources exist), `product-manager` (roadmap progress, if product docs exist). Skip any specialist with no new evidence. Chief of Staff consolidates.

## Workflow
1. Run `records.py stale`; list actions closed, slipped, newly overdue.
2. Decide which specialists add value this week; delegate bounded questions in parallel with the as-of date and sources.
3. Collect findings; check conflicts (e.g. spend up while runway tight; roadmap vs engineering capacity).
4. Compare against last week's report only to identify changes; re-verify any carried-over claim.
5. Draft the review; list decisions for approval and proposed new actions/risks.
6. After the founder approves, record decisions/actions/risks and save the report to `records/reports/YYYY-MM-DD-weekly-review.md` (`valid_until` = +7 days).

## Output format
```
WEEKLY REVIEW - week ending <date> (snapshot, valid until <date+7>)
1 Headlines (3 bullets)
2 Progress: actions closed/slipped/overdue (IDs)
3 Product & engineering
4 Finance signals (INR, period stated)
5 Compliance: items due in next 30 days
6 Risks: new/changed (IDs)
7 Conflicts between specialists
8 Decisions for you | Proposed actions | Proposed risks
9 Verification table: Claim | Source | Verified on | Confidence
10 Unverified items
```

## Verification requirements
Carried-over facts are re-verified or marked 'carried from <report>, not re-verified'. Numbers cite source and read time. Specialist findings keep their confidence labels.
Every material finding uses `Claim | Source | Verified on | Confidence | Basis`. Output is a dated snapshot: include `as_of` and `valid_until`.

## Failure handling
If a source is unavailable, continue with the rest, label dependent sections `UNVERIFIED - <source> unavailable`, and list the setup step from `docs/integration-inventory.md`. Never fill gaps with guesses. If a specialist returns no sources, send it back once, then mark its findings UNVERIFIED.

## Approval requirements
Producing the review needs none. Writing decision records requires explicit founder approval (guard hook asks). Actions, risks and the report file may be written after the founder confirms the content.
