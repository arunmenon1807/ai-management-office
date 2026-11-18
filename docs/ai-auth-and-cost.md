# AI authentication and cost (verified 2026-11-13)

Sources read this session (official, Confidence: Medium because docs change):
- https://code.claude.com/docs/en/agent-sdk/overview
- https://code.claude.com/docs/en/headless

## Findings

| Question | Finding |
|---|---|
| Can an app built on the **Claude Agent SDK** use my claude.ai subscription? | The SDK docs say: unless previously approved, Anthropic does not allow third-party developers to offer claude.ai login or rate limits for products built on the SDK; use API-key authentication. An SDK-based app would therefore be **pay-as-you-go API** usage. Not used here. |
| Is `claude -p` (headless Claude Code CLI) a supported way to run Claude Code programmatically? | Yes, documented ("Run Claude Code programmatically"). It uses the CLI's own login unless `--bare` is passed (bare mode requires an API key). |
| Which path does this app use? | **`claude -p`, run as a subprocess of the official CLI, using your own Claude Code sign-in.** No SDK package, no token extraction, no proxying. |
| Is that guaranteed free of extra charges? | **Not guaranteed.** Usage is billed by however your Claude Code login is plan-covered (subscription limits). Heavy automated use (reports, multi-agent delegation) consumes your plan limits faster. Confirm your plan's terms for programmatic use. The app cannot see plan usage. |

## Safeguards built in
- `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and Bedrock/Vertex/Foundry switches are **removed from the child process environment** (`src/lib/claude.ts`, tested). A key present in your shell is ignored and flagged in Settings.
- `--bare` is never used. No API key is created or requested.
- If Claude Code is not signed in, chat and report generation return an honest "unavailable" message. Your message is saved. Nothing falls back to another service.
- Reported per-reply cost (`total_cost_usd`) is stored when Claude Code reports it; it is a client-side estimate, not a bill.

## One-time setup you must do
Open Terminal and run `claude auth login`, finish sign-in in the browser, then check Settings in the app. (An assistant cannot sign in for you.)

## Status in this build (updated 2026-11-16)
Signed in on 2026-11-13 (claude.ai, Pro). Real conversations, delegation, reports and session resume have been run against the real runtime (`npm run test:live` and manual live checks). The mock tests only prove our own parsing and process handling.

Cost notes for the newer features: each conversation keeps one warm `claude` process (closed after 20 minutes idle), so follow-ups do not restart the agent. Delegated work, reports, and agents reading their notes plus Drive files all consume plan usage. Agent notes reduce repeated reading but do not remove it. The app still cannot see plan usage. Voice input is done by the browser, not by Claude, and has no Claude cost.
