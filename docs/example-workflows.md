# Example workflows

A full MOCK cross-functional decision lives in `examples/mock-decision-workflow/` (all data is invented and labelled MOCK).

## A. Cross-functional decision: "Should we launch a paid AI tier for the primary product?"
1. `/decision-review Launch a paid AI tier for the primary product?`
2. Chief of Staff frames options (launch now / pilot / defer), deadline, reversibility.
3. Delegates in parallel to product-manager (customer need), cto (feasibility, AI cost per user), cfo (pricing economics, runway), chartered-accountant (GST and invoicing for subscriptions, foreign customers), marketing-growth (positioning, channel). company-secretary is skipped unless governance (e.g. data-processing terms) is raised.
4. Conflict check: marketing wants aggressive acquisition spend, CFO caps spend by runway; CTO wants a hardening sprint first, PM wants a faster pilot.
5. Consolidated recommendation, confidence, decisions for approval.
6. Founder approves "pilot with cap". Chief of Staff records DEC, ACTs (owner, due), RSK entries, and the report.
7. External steps stay with the founder: enabling pricing in the billing system, publishing the announcement, any filing.

## B. Morning brief
`/daily-brief` checks `records.py stale`, GitHub runs (read-only), Vercel/Railway deployment status, then prints a one-screen brief. If a deploy failed it calls the cto for diagnosis only.

## C. Compliance check before a funding conversation
`/compliance-check` -> company-secretary + chartered-accountant -> register table with `unknown` where evidence is missing -> list of what the appointed CS/CA must confirm -> founder confirms register updates.

## D. Spend anomaly
Founder: "Hosting cost looks high." Chief of Staff calls cto (cost drivers via Vercel deployments/billing) and cfo (impact). Output: causes, options, decision for the founder; no config changes made.
