---
name: technology-review
description: "Technology and infrastructure review: architecture, repos, deployments, hosting cost, security posture, technical debt and AI provider usage, ending with prioritised recommendations."
---

# /technology-review

Run as the Chief of Staff (main session). Follow CLAUDE.md principles: advisory, read-only, evidence-labelled, founder approves.

## When to use
Quarterly, monthly via MBR, before launches, after incidents or cost spikes, and for build-vs-buy questions.

## Required data sources
- `company/facts/technical-architecture.md`
- GitHub read-only (`gh repo view`, `gh pr list`, `gh issue list`, `gh run list`) on repos listed in `records/sources.md`; local read of repo files only if the founder grants the path (via change_directory/request_directory)
- Vercel and Railway read-only connectors (projects, deployments, status, runtime errors)
- Cloudflare: connector needs OAuth (see inventory); otherwise founder-supplied notes
- AI provider usage: founder-supplied export

Check availability first (see `docs/integration-inventory.md`). Do not assume any source is connected or authenticated.

## Relevant agents
`cto` (lead). `cfo` for cost trade-offs, `product-manager` for roadmap impact, `chartered-accountant` only for tax-relevant vendor questions.

## Workflow
1. Confirm scope (which product/repo/environment) and check which sources are reachable.
2. Delegate to cto with the as-of date and explicit read-only instruction. Add cfo/product-manager only where a cost or roadmap trade-off is in play.
3. Validate evidence: repo@commit, project and deployment IDs, read time.
4. Conflict check: security fixes vs roadmap speed; cost cuts vs reliability.
5. Consolidate: architecture snapshot, risk table, ranked recommendations with effort ranges, founder-only actions.
6. After approval, record decisions/actions/risks and save `records/reports/YYYY-MM-DD-technology-review.md` (`valid_until` = 30 days).

## Output format
```
TECHNOLOGY REVIEW - <scope> <date> (snapshot, valid until <date>)
Recommendation (3 lines)
Architecture and infrastructure snapshot
Risk table: Risk | Severity | Evidence | Mitigation | Effort
Cost drivers
Options and trade-offs
Founder-only actions (deploy, config, secrets rotation, PRs)
Access gaps / UNVERIFIED
```

## Verification requirements
Findings cite repo@commit or project/deployment ID and read time. Secret values are never read or quoted. Best-practice claims carry a reference and Medium/Low confidence.
Every material finding uses `Claim | Source | Verified on | Confidence | Basis`. Output is a dated snapshot: include `as_of` and `valid_until`.

## Failure handling
If a source is unavailable, continue with the rest, label dependent sections `UNVERIFIED - <source> unavailable`, and list the setup step from `docs/integration-inventory.md`. Never fill gaps with guesses. If a specialist returns no sources, send it back once, then mark its findings UNVERIFIED. If the guard blocks a command, report it; do not attempt alternatives that bypass it.

## Approval requirements
No code changes, commits, pushes, PRs, issues, deployments, rollbacks, env/config edits or secret rotation. Every such step is performed by the founder. The primary product and other business repos are never modified.
