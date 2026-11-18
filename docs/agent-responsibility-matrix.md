# Agent responsibility matrix

R = responsible (leads) C = consult when affected - = not involved

| Topic | Company Sec. | CA / Tax | CFO | CTO | Product | Marketing |
|---|---|---|---|---|---|---|
| Legal structure, directors, shareholding | R | C | - | - | - | - |
| ROC/MCA and Companies Act obligations | R | C | - | - | - | - |
| Board / shareholder resolutions (drafts) | R | C | C | - | - | - |
| GST, TDS, income tax, advance tax | C | R | C | - | - | - |
| Bookkeeping hygiene, invoicing treatment | - | R | C | - | - | - |
| Cash, runway, budget vs actual | - | C | R | - | - | - |
| Pricing economics, unit economics | - | C | R | - | C | C |
| Cloud / AI / tooling cost control | - | C | R | C | - | - |
| Architecture, infra, security | - | - | - | R | C | - |
| Build vs buy, vendor/AI provider choice | - | C | C | R | C | - |
| Roadmap, requirements, launch readiness | C | - | C | C | R | C |
| New product / service evaluation | C | C | C | C | R | C |
| Positioning, channels, campaigns | C (claims) | - | C (budget) | - | C | R |
| Fundraising or share issue | R | R | R | - | - | - |

## Delegation rules
1. Start with the single most relevant specialist; add others only where the matrix shows C and the decision is actually affected.
2. Never run all six unless every domain is truly affected (the monthly review is the usual exception).
3. Statutory and tax items always go to the Company Secretary or CA first, with the "confirm with appointed professional" caveat.
4. Any money impact goes to the CFO; any customer-data or regulatory-claim impact goes to the Company Secretary.

## Tool restrictions
| Agent | Files | Web | Bash | Drive (read) | Vercel (read) | Railway (read) |
|---|---|---|---|---|---|---|
| company-secretary | R | yes | no | yes | no | no |
| chartered-accountant | R | yes | no | yes | no | no |
| cfo | R | yes | no | yes | yes (billing, deployments) | no |
| cto | R | yes | yes (read-only via guard) | yes | yes | yes |
| product-manager | R | yes | no | yes | no | no |
| marketing-growth | R | yes | no | yes | no | no |

No specialist has Write/Edit or can spawn agents. The agent `tools:` lists are an allowlist; the guard hook applies on top.
