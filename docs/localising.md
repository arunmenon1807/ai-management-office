# Localising for another country

The wizard asks for country and currency and renders them into `CLAUDE.md` and the facts files, so the Chief of Staff, CFO, CTO, PM and Marketing agents work anywhere. The two statutory specialists are different: **`company-secretary` and `chartered-accountant` default to Indian law** (Companies Act / ROC / MCA, GST, TDS, income tax, FEMA, DPDP). Do not rely on them for another jurisdiction until you have adapted them.

## To adapt
1. In `.claude/agents/company-secretary.md` and `.claude/agents/chartered-accountant.md`: replace the Indian statutes, filings and registers with your jurisdiction's equivalents, and rename the roles if needed (for example Accountant / Company Secretary, or Corporate Counsel).
2. Keep the evidence rule: regulatory content stays **Low confidence** unless read from the official source in the session. Add your regulator's official URLs.
3. In `templates/CLAUDE.md.tmpl`, update the example lists ("GST, ROC/MCA, TDS", "PAN/Aadhaar-like") and in `.claude/guard-policy.json` the identifier patterns, so the guard scans for your country's sensitive identifiers (for example SSN, NI number). Add allow and deny cases to `tests/validate.py`.
4. In `templates/facts/*` change India-specific rows (financial year, registration identifiers, tax status).
5. Re-render: `python3 scripts/init_company.py --yes`, then `python3 tests/validate.py`.

A well-structured `docs/packs/<country>.md` plus agent files is a welcome contribution.
