---
name: daily-brief
description: "Produce the founder's short daily brief: what changed, what is due, what needs a decision today. Use each morning or when asked for today's priorities."
---

# /daily-brief

Run as the Chief of Staff (main session). Follow CLAUDE.md principles: advisory, read-only, evidence-labelled, founder approves.

## When to use
Each working day, or on request ('what do I need to know today?'). Not for deep analysis (use the weekly or monthly reviews).

## Required data sources
- `python3 scripts/records.py status` and `stale` (open actions, risks, compliance, stale items)
- `records/actions/`, `records/compliance/` for due dates in the next 7 days
- GitHub (read-only `gh pr list`, `gh run list` on repos in `records/sources.md`) if available
- Vercel/Railway deployment status via read-only connectors if available
- Drive recent files (read-only) if available

Check availability first (see `docs/integration-inventory.md`). Do not assume any source is connected or authenticated.

## Relevant agents
None by default (Chief of Staff alone). Call `cto` only if a production error or failed deployment is found; `company-secretary` or `chartered-accountant` only if a statutory item is due within 7 days.

## Workflow
1. Run `records.py stale` and `status`; list due/overdue actions and compliance items (next 7 days).
2. Check each available live source (see Required data sources). Record which were reachable.
3. Pull anything new or failing: failed deploys, open PRs awaiting review, new Drive files of note.
4. Rank items: Needs decision today / Due soon / FYI.
5. Write the brief (format below). Do not write a report file unless the founder asks; if asked, save to `records/reports/YYYY-MM-DD-daily-brief.md` with `valid_until` = next day.

## Output format
```
DAILY BRIEF - <YYYY-MM-DD> (snapshot, valid until <next day>)
Sources checked: <list> | Unavailable: <list>
NEEDS YOUR DECISION (max 3): item - recommendation - source/confidence
DUE IN 7 DAYS: item - date - status - source
WATCH: risks/anomalies
FYI: one line each
UNVERIFIED: ...
```
Max one screen. Lead with the most time-critical item.

## Verification requirements
Every dated item cites its record ID or live source. Due dates come from records or sources, never from memory. State 'checked at <time>' for live sources.
Every material finding uses `Claim | Source | Verified on | Confidence | Basis`. Output is a dated snapshot: include `as_of` and `valid_until`.

## Failure handling
If a source is unavailable, continue with the rest, label dependent sections `UNVERIFIED - <source> unavailable`, and list the setup step from `docs/integration-inventory.md`. Never fill gaps with guesses. If a specialist returns no sources, send it back once, then mark its findings UNVERIFIED. If everything is unavailable, the brief reports only local records and says so in the first line.

## Approval requirements
None to produce the brief. Any action it suggests (filing, payment, deploy, email) is only a recommendation; the founder performs it.
