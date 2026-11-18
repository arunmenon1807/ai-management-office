# company/conclusions - AI-generated analysis

Working analyses by the Chief of Staff and specialists that are worth keeping between sessions (for example a technology landscape summary). Not authoritative.

Every file must start with frontmatter:
```
---
title: ...
layer: ai-conclusion
as_of: YYYY-MM-DD
valid_until: YYYY-MM-DD
status: snapshot
derived_from: [SRC-xxx, company/facts/xxx.md]
confidence: High|Medium|Low
---
```
Rules: cite sources, never overwrite `company/facts/`, and re-verify before reuse. Past `valid_until`, treat as history only (`scripts/records.py stale` does not scan this folder; the weekly review lists files here older than 90 days).
