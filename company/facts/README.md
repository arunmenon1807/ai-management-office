# company/facts - authoritative source data

Founder-confirmed facts about Your Company, one file per topic. These are the only AI-readable files treated as authoritative. Everything an agent concludes lives elsewhere (`company/conclusions/`, `records/reports/`).

Rules
1. Each fact has a source, `verified_on` and confidence. `status: UNVERIFIED` at the top means the file is not yet confirmed overall.
2. Agents propose changes in their reports; the founder edits (or approves an edit; the guard hook asks).
3. No secrets or sensitive identifiers. Reference them by source ID.
4. Review at least quarterly. A fact whose `verified_on` is more than 180 days old is treated as Medium at best.
