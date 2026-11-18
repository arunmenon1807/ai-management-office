---
name: decision-review
description: "Run a cross-functional decision workflow: frame the decision, consult only the relevant specialists, check conflicts, recommend, obtain approval and record the decision and follow-ups."
---

# /decision-review

Run as the Chief of Staff (main session). Follow CLAUDE.md principles: advisory, read-only, evidence-labelled, founder approves.

## When to use
Whenever the founder faces a material choice (new product, pricing, hiring, spend, vendor, structure, launch) or asks 'should we...?'.

## Required data sources
- `company/facts/` (strategy, financial assumptions, products, governance)
- Existing `records/decisions` (for supersession and precedent) and `records/risks`
- Source systems relevant to the question (read-only)
- Public sources via WebSearch/WebFetch where needed (Low confidence unless corroborated)

Check availability first (see `docs/integration-inventory.md`). Do not assume any source is connected or authenticated.

## Relevant agents
Chosen per decision from `docs/agent-responsibility-matrix.md`. Typical: `cfo` for any money impact, `chartered-accountant` for tax impact, `company-secretary` for governance impact, `cto` for feasibility, `product-manager` for customer and scope, `marketing-growth` for go-to-market. Never all six unless every domain is truly affected.

## Workflow
1. Frame: decision statement, options (including 'do nothing'), deadline, reversibility, budget, who decides. Ask the founder only for facts that cannot be found.
2. Select specialists by domain impact; write bounded briefs (question, sources, format, as-of date, read-only, no external actions). Run in parallel.
3. Collect and validate evidence labels. Reject unsourced material findings once.
4. Conflict check: tabulate each specialist's position on cost, time, risk and scope. Flag disagreements with each side's reasoning; do not silently resolve.
5. Consolidate: recommended option, rationale, risks, confidence, assumptions, what would change the answer, review date.
6. Present the decision brief. State which decisions need approval and which external steps only a human or professional can perform.
7. On explicit founder approval in chat: create the decision record (`python3 scripts/records.py new decision "<title>"`, guard will ask), fill it, set `approved_by`, `approved_on`, `review_by`; create action items (`records.py new action`) and risks; add source IDs. If the founder defers or rejects, record status `proposed`/`rejected` accordingly.

## Output format
```
DECISION BRIEF - <title> - <date> (snapshot)
Decision needed | Options | Deadline | Reversibility
Recommendation and rationale (confidence)
Specialist input: Agent | Position | Key evidence | Confidence
Conflicts and trade-offs
Financial / tax / governance / technical / product / growth impact (only those consulted)
Risks and assumptions | What would change this
Approval requested: [ ] Option A [ ] Option B [ ] Defer
Follow-ups (proposed actions with owner and date)
UNVERIFIED items
```

## Verification requirements
Evidence table is mandatory. Approved decisions carry approved_by, approved_on, review_by and source IDs; `records.py check` must pass after recording.
Every material finding uses `Claim | Source | Verified on | Confidence | Basis`. Output is a dated snapshot: include `as_of` and `valid_until`.

## Failure handling
If a source is unavailable, continue with the rest, label dependent sections `UNVERIFIED - <source> unavailable`, and list the setup step from `docs/integration-inventory.md`. Never fill gaps with guesses. If a specialist returns no sources, send it back once, then mark its findings UNVERIFIED. If a decisive input is unverifiable, recommend 'defer and gather X' rather than guessing.

## Approval requirements
Founder must approve in chat before any decision record is marked approved. External steps (filing, payment, contract signing, deployment, communication) always remain founder/professional actions, even after approval.
