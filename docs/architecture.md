# Architecture

## Principle
Smallest thing that works, using Claude Code's own primitives. No LangChain/CrewAI, database, web UI or external orchestrator.

```
Founder
  |  (chat)
Chief of Staff = main Claude Code session  <- CLAUDE.md (principles, workflow, approval gates, evidence policy)
  |  invokes
Skills (.claude/skills/*)  = reusable workflows: daily-brief ... decision-review
  |  delegates bounded tasks via Agent tool (isolated contexts, parallel when independent)
Specialists (.claude/agents/*): company-secretary, chartered-accountant, cfo, cto, product-manager, marketing-growth
  |  read-only tools only
Sources: company/facts (authoritative) | company/private (local, ignored) | MCP/CLI connectors (live, read-only)
  |
Records: records/{decisions,actions,risks,compliance,reports} + records/sources.md   (written by Chief of Staff, gated)
  |
Safety layer: settings.json permissions + PreToolUse guard hook + audit log + SessionStart staleness hook
```

## Components
| Layer | Location | Role |
|---|---|---|
| Operating principles | `CLAUDE.md` | Loaded every session; defines Chief of Staff workflow, approval gates, evidence policy |
| Specialists | `.claude/agents/` | One file each. Restricted `tools:`; no Write/Edit; only the CTO has Bash (read-only by hook) |
| Workflows | `.claude/skills/` | Seven skills, each with sources, agents, steps, output, verification, failure and approval sections |
| Authoritative data | `company/facts/` | Founder-confirmed facts with source and `verified_on` |
| Sensitive data | `company/private/` | Git-ignored; agents cannot write; referenced by ID |
| AI conclusions | `company/conclusions/`, `records/reports/` | Dated snapshots with `valid_until` |
| Records | `records/` | Decisions, actions, risks, compliance register, source register |
| Tooling | `scripts/records.py` | ID allocation, validation, staleness report (stdlib only) |
| Safety | `.claude/settings.json`, `.claude/hooks/guard.py`, `.claude/guard-policy.json` | Enforcement outside the model's discretion |
| Validation | `tests/validate.py` | Static checks, guard case table, records tests |

## Design decisions
1. **Specialists are read-only and return findings; the Chief of Staff writes records.** One writer simplifies audit and prevents specialists from changing official records.
2. **Isolation by delegation.** Each brief carries only the needed context. Specialists do not see each other's raw output; the Chief of Staff reconciles.
3. **Pointers over copies.** Records hold locators and status, not duplicated content from Drive, GitHub or hosting systems.
4. **Policy as data.** `guard-policy.json` holds the rules so they can be reviewed and tested without reading code.
5. **Fail closed.** Guard errors deny. Unknown external MCP tools are denied unless they match a read verb.
6. **Labelled uncertainty.** Evidence format and confidence levels are mandatory and tested in agent definitions.

## Data flow for a typical request
Request -> Chief of Staff selects specialists -> briefs with as-of date -> read-only calls through guard -> findings with evidence labels -> conflict check -> consolidated brief -> founder approves -> records written (decision write is gated) -> follow-ups tracked in `records/actions`.
