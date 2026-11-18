# Integration inventory

Fill this in for your own environment. "Reachable" means a harmless read call succeeded in a session; it does not mean the integration is correctly scoped. Re-check at session start; nothing here is a standing fact.

| Integration | Mechanism | State (date checked) | Write tools the connector exposes | Posture here | To connect / improve |
|---|---|---|---|---|---|
| Google Drive | Claude connector (MCP) | not checked | create/update/trash/share file | Read-only (search, metadata, read). `create_file` only via the approval flow in `docs/app-guide.md`. Everything else denied | Register folder IDs in `records/sources.md`. Prefer a dedicated records folder; keep sensitive files in Drive, referenced by ID |
| Gmail | Claude connector (MCP) | not checked | send, reply, forward, label, trash | Read and **draft** only. Sending and everything else denied by the guard; you send from Gmail | Decide which labels agents may search |
| GitHub | `gh` CLI | not checked | full via CLI | Read commands only. Writes denied by the guard | Use a fine-grained read-only token (Contents, Pull requests, Issues, Actions: read) |
| Vercel | MCP connector | not checked | deployments, domains, env vars, firewall, purchases | Read-only: projects, deployments, runtime errors, billing. Env/secret readers denied | Record team/project IDs in `records/sources.md` |
| Railway | MCP connector | not checked | deploy, redeploy, set-variables, delete, agent | Read-only: list projects/services, status. Writes, variable listing and the Railway agent denied | Record project IDs |
| Cloudflare | MCP connector (needs OAuth in `/mcp`) | not checked | DNS, workers, rules | Read-only if adopted | Authorize only if used |
| AI provider billing | none | not connected | n/a | Manual: export usage/cost CSVs into your git-ignored private folder or Drive | Provider admin APIs need an admin key; never paste keys in chat. Use a read-only usage key in an OS keychain |

Delete rows you do not use. Add rows for what you adopt.

## Connection method rules
- Authenticate via OAuth in `/mcp` or the tool's own CLI login. Never paste secrets into chat or files.
- New integration: add a row here, add locators to `records/sources.md`, extend agent `tools:` with read tools only, run `python3 tests/validate.py`.
- Guard behaviour for an unknown MCP server: tool names starting with a read verb (get, list, search, find, read, describe, fetch, check, count, aggregate, download, query, show, whoami, status) pass; names containing credential/secret/token/env/variables/api-key/bypass/signing/password are denied; everything else is denied.
- Custom connectors may appear under installation-specific IDs instead of friendly names. If so, add them to `tools:` in the agent files and to the guard's test table.

## Dependent workflows when a source is unavailable
Skills mark the dependent section `UNVERIFIED - <source> unavailable` and give the setup step. Nothing is silently skipped.
