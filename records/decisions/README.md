# records/decisions

Approved or proposed decisions. Only the founder's explicit approval makes a decision `approved`. Writes are gated by the guard hook.

Frontmatter fields: id, title, status (proposed|approved|rejected|superseded), approved_by, approved_on, owner, review_by, supersedes

Create with `python3 scripts/records.py new <type> "<title>"` (reports are written by the skills). Validate with `python3 scripts/records.py check`.
