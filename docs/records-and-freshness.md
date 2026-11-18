# Records, freshness and source of truth

## Layers
1. **Authoritative**: `company/facts/` (founder-confirmed), `company/private/` (local sensitive records) and the connected systems themselves (Drive, GitHub, hosting, books). These win in any conflict.
2. **Derived records**: decisions (authoritative once founder-approved), actions, risks, compliance register (status plus pointers).
3. **Snapshots**: reports and conclusions. Dated, with `valid_until`. They are history after expiry and never evidence for a current fact.

## What is stored where
| Need | Location | Notes |
|---|---|---|
| Decisions | `records/decisions/DEC-nnnn-*.md` | approved_by, approved_on, review_by, sources |
| Action items | `records/actions/ACT-nnnn-*.md` | owner, due, decision_ref |
| Risks | `records/risks/RSK-nnnn-*.md` | likelihood, impact, review_by |
| Compliance status | `records/compliance/CMP-nnnn-*.md` | pointers to evidence, last_verified, verified_via |
| Reports | `records/reports/YYYY-MM-DD-*.md` | type, as_of, valid_until, status: snapshot |
| Source references | `records/sources.md` | locator, sensitivity, last_verified |
| Audit | `logs/audit.jsonl` (local) | guard decisions |

Records store pointers and status, not copies of Drive/GitHub/hosting content.

## Keeping records current without trusting stale ones
1. **Dates on everything**: `as_of` and `valid_until` on reports; `review_by` on risks and decisions; `last_verified` on compliance and sources.
2. **Staleness detection**: `python3 scripts/records.py stale` flags overdue actions, overdue reviews, compliance entries never verified or older than 90 days, and expired reports. A SessionStart hook prints a summary each session so staleness is visible before work starts.
3. **Re-verify before reuse**: every skill reads live sources first. A previous report is used only to find what changed; carried-over claims are re-verified or labelled "carried, not re-verified".
4. **Unknown by default**: compliance status starts `unknown`; scorecard cells read `Unknown` without verified data.
5. **Supersession not overwrite**: a changed decision gets a new record with `supersedes`; the old becomes `superseded`. Reports are never edited, only replaced by new dated ones.
6. **Confidence decay**: facts older than 180 days are Medium at best; evidence older than 90 days is Low unless re-read.
7. **Single writer**: only the Chief of Staff writes records, after founder approval where required.

## Validation
`python3 scripts/records.py check` validates frontmatter and approval fields. `tests/validate.py` runs it in a temp directory as a regression test.
