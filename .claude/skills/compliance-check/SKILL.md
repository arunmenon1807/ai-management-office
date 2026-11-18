---
name: compliance-check
description: "Check corporate and statutory compliance status, upcoming obligations and evidence gaps; prepare working notes for the appointed professionals. Never files anything."
---

# /compliance-check

Run as the Chief of Staff (main session). Follow CLAUDE.md principles: advisory, read-only, evidence-labelled, founder approves.

## When to use
Monthly, before board meetings or funding conversations, when a notice or deadline is spotted, or when a business change may create obligations.

## Required data sources
- `company/facts/identity-legal.md` and `company/facts/governance-compliance.md`
- `records/compliance/` register
- Drive evidence documents named in `records/sources.md` (read-only)
- Official portals read via WebFetch for rules/dates (MCA, GST, Income Tax, CBIC) - Low confidence unless read this session
- `company/private/` only if the founder explicitly points to a file

Check availability first (see `docs/integration-inventory.md`). Do not assume any source is connected or authenticated.

## Relevant agents
`company-secretary` (corporate/ROC/MCA, governance), `chartered-accountant` (GST, TDS, income tax, accounting). Both only when the check touches their area.

## Workflow
1. Confirm scope (entity-level, tax-only, or triggered by an event). Read facts; flag `TBD` identity items first because obligations depend on them.
2. Delegate bounded questions to the relevant specialists with as-of date and sources.
3. Reconcile each obligation: authority, frequency, next due, evidence pointer, last verified, status. Use `unknown` rather than assuming `on_track`.
4. Compare with the existing register; list new, changed, overdue and unverifiable items.
5. Draft the compliance report and proposed register updates; list what the appointed CS/CA must confirm and what only the founder or professional can do.
6. After founder confirmation, update `records/compliance/` (`records.py new compliance`) and save `records/reports/YYYY-MM-DD-compliance-check.md` (`valid_until` = 30 days).

## Output format
```
COMPLIANCE CHECK - <date> (snapshot; regulatory content Low confidence unless stated)
Scope | Entity facts used (with verified_on)
Overdue / due in 14 days / due in 60 days
Register table: ID | Obligation | Authority | Next due | Evidence pointer | Last verified | Status
Candidate obligations to confirm
What the appointed professional must confirm
Founder-only actions
UNVERIFIED items and missing sources
```
Header line always: 'Decision support, not a substitute for the appointed Company Secretary / Chartered Accountant.'

## Verification requirements
Statuses require an evidence pointer and last_verified date; otherwise `unknown`. Dates and rules cite the official URL and read date. Nothing is marked `filed` without evidence read this session.
Every material finding uses `Claim | Source | Verified on | Confidence | Basis`. Output is a dated snapshot: include `as_of` and `valid_until`.

## Failure handling
If a source is unavailable, continue with the rest, label dependent sections `UNVERIFIED - <source> unavailable`, and list the setup step from `docs/integration-inventory.md`. Never fill gaps with guesses. If a specialist returns no sources, send it back once, then mark its findings UNVERIFIED. If entity facts are TBD, produce only the 'information needed' list and stop.

## Approval requirements
No filing, submission, portal login or communication with authorities. Register updates and report need founder confirmation. Decisions on compliance strategy go through `/decision-review`.
