# records/compliance

Compliance obligation register. Holds status and pointers only; evidence stays in source systems. Never mark `filed` without evidence read in-session.

Frontmatter fields: id, title, status (unknown|not_started|on_track|due_soon|overdue|filed|not_applicable), authority, frequency, due, evidence_ref, last_verified, verified_via

Create with `python3 scripts/records.py new <type> "<title>"` (reports are written by the skills). Validate with `python3 scripts/records.py check`.
