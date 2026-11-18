# AI Management Office: application guide

## 1. Audit of the existing project (2026-11-13)

| Item | Finding |
|---|---|
| Agents | 6 in `.claude/agents/`: company-secretary, chartered-accountant, cfo, cto, product-manager, marketing-growth (frontmatter: name, description, tools, model). The 7th, **Chief of Staff**, is the main session defined by `CLAUDE.md`. |
| Skills | 7 in `.claude/skills/`: daily-brief, weekly-review, monthly-business-review, compliance-check, financial-review, technology-review, decision-review. |
| Delegation | Native Claude Code: Chief of Staff uses the Agent tool per `CLAUDE.md` workflow and `docs/agent-responsibility-matrix.md`. Reused unchanged. |
| Safety | `.claude/hooks/guard.py` + `guard-policy.json` + `settings.json` permissions: advisory/read-only; blocks pushes, deploys, sends, secret reads. Still active for every app chat because the app runs the real CLI from the repo root. |
| Knowledge | `company/facts` (founder-confirmed; most are TBD), the private records folder (git-ignored), `records/*` (decisions, actions, risks, compliance, reports) written by `scripts/records.py`. |
| Integrations | See `docs/integration-inventory.md`. The app's Settings → Connectors now shows live health. |
| Reusable as-is | All of the above. |
| New | `apps/web` (UI + API + SQLite), `apps/launcher`, this guide, `docs/ai-auth-and-cost.md`. Later changes to existing files, each with founder approval: Drive tools added to all agents; Drive `create_file` approval gate in the guard; per-agent notes and the ask-when-in-doubt rule; `tests/validate.py` adjusted accordingly. |

**Conflict resolved:** the brief suggested a separate `agent-service` and the Agent SDK. The SDK cannot use a subscription (see `ai-auth-and-cost.md`), and a second service adds nothing. So one local Next.js process runs `claude -p` itself. **shadcn/ui** was not installed; the UI uses small Tailwind components (`.card`, `.btn`) with Lucide icons instead. Not a git repository yet: no commits or branches were made.

## 2. Architecture (updated 2026-11-16)

```
Browser (localhost:3000) ── Next.js 16 (127.0.0.1 only)
   pages (server-rendered)     API routes ─ proxy.ts (host + Origin + JSON checks)
                                  │
              SQLite (node:sqlite, built into Node) in ~/Library/Application Support/AI Management Office/
                                  │
              jobs.ts: one background job per conversation (independent of the browser page)
                                  │
              claude.ts: one long-lived `claude -p --input-format stream-json` process per conversation
              (`--agent <slug>`, `--resume <session>`) in the repo root
              → existing CLAUDE.md, agents, skills, hooks, permissions apply
```

- Agents and skills are **discovered from files each request**; there is no second list. Adding `.claude/agents/new.md` makes it appear in AI Team. Adding `.claude/skills/x/SKILL.md` adds a Reports "Generate" button.
- Chief of Staff = no `--agent` flag (main session). Specialists = `--agent <slug>`.
- **Memory inside a conversation:** the CLI session id is stored per conversation. One warm process per conversation (20 minutes idle timeout) keeps context loaded; if it has ended, the next message resumes with `--resume`. History is never replayed into a fresh prompt. If a resume fails you get an error and the history stays.
- **Leave and come back:** a message runs as a server-side job. Leaving the page does not cancel it. When you return, the page re-attaches (replays what happened, then follows live) and the answer is saved either way. The **Stop** button is the only thing that cancels. If the connection drops (Mac sleep, Wi-Fi change, background tab), the page shows "Reconnecting" instead of an error and re-attaches until the job ends, then loads the saved answer. While an agent is working the app runs `caffeinate -i -s` so the Mac does not idle-sleep (the display may still sleep; closing the lid or choosing Sleep cannot be prevented, and the agent pauses until wake). Jobs live in memory: quitting the app mid-answer loses that answer; your message is saved and the next message resumes the session.
- **Permissions of a chat turn:** `--permission-mode dontAsk`. Anything not pre-allowed is denied, not prompted. Pre-allowed: **WebSearch and WebFetch** (added 2026-11-16; the guard still blocks requests containing secrets or PAN/Aadhaar-like identifiers, and every agent and `CLAUDE.md` instruct agents to keep confidential company details out of queries; this is an instruction, not a technical block), read-only connector tools (derived from the agents' tool lists, filtered by `guard-policy.json`), and `Edit` under `company/agent-notes/**` only (section 4b).
- Tables: conversations (with `handoff`), messages, tasks, reports, report_versions, approvals, audit, settings, doc_links (migrations by `PRAGMA user_version`).

### 2b. Chief of Staff delegation, group-chat view, personal chats
When the Chief of Staff delegates to a specialist, the chat shows the exchange like a group chat: the Chief's brief, the specialist's tool calls and findings, then the Chief's consolidated answer. Each delegation has **Continue with <specialist> directly**, which opens a personal chat with that specialist. Context (your original request, the brief, the findings) is handed over once, on the first message only, so you do not repeat yourself; it is shown in a collapsible banner. Delegation capture verified live and with mock tests; the founder has been using the flow.

### 2c. Voice input
Each chat has a Voice button (browser speech recognition). Chrome and Safari send the audio to Google or Apple to transcribe it; the app shows this note. Confirmed working by the founder on 2026-11-16.

## 3. Daily use (no Terminal)

- **Start:** open **AI Management Office** from the Dock / Applications (an AppleScript app made by `apps/launcher/make-app.sh`), or double-click `apps/launcher/start.command`. It reuses a running server, builds on first run, waits for health, opens the browser. **Stop:** `apps/launcher/stop.command`. Re-run `make-app.sh` if you move the project folder. First launch: right-click, Open once; if macOS asks about the Documents folder, choose Allow.
- **Specialist chat:** AI Team → Start conversation. Rename/delete (confirm) from the conversation header; search on Conversations.
- **Reports:** Reports → Generate runs the real skill (minutes). Versions are kept; export Markdown. PDF export is not built (use browser Print → Save as PDF).
- **Tasks:** add/edit manually. Agents cannot create tasks.
- **Approvals:** section 4.
- **Documents:** read-only browse/search of `company/facts`, `company/conclusions`, `company/agent-notes`, `records`, `docs`. The private records folder is excluded unless you add its absolute path to the `approved_doc_roots` setting.
- **Settings:** AI connection, agents and skills, **Agent notes**, **Connectors**, data and backup.

### Connectors (Settings)
Lists the MCP connectors Claude Code knows about, with live health from `claude mcp list` (cached 60 s). Per connector: Authenticate / re-authenticate (opens the provider's real sign-in), Sign out, Remove. Add: https URLs only, no embedded credentials, no localhost. Stdio and API-key servers cannot be added from the UI. Founder confirmed Authenticate and the panel work (2026-11-16).

### Google Drive
All six specialists and the Chief of Staff can search and read Drive (read-only tools are pre-approved). They can also **create new Drive files**, with your approval each time (4a).

## 4. Approvals: what is and is not enforced

Enforced in code and tested: a decision can be made once; `consumeApproval()` requires status *approved*, an identical payload hash, and marks it used (replay fails). The guard hook still blocks external writes. **No executor exists for email, GitHub, deploy, payment or filing**: approving those records your decision only. The one real executor is Drive file creation (4a).

### 4a. Drive file creation (added 2026-11-16)
1. An agent calls Drive `create_file`. The guard hook (`guard.py`, policy key `drive_create`) denies it inside the app, and the app saves the exact tool input as an approval of kind `drive.create_file`.
2. The chat shows a card: file name, "Show exactly what will be saved", **Approve and save to Drive** / **Reject**.
3. On Approve the approval is consumed (single use), then a short-lived process runs with `AIMO_APPROVED_DRIVE_WRITE=<sha256 of the exact input>`. The hook allows only a call whose input hash matches. A changed file is refused; content with PAN/Aadhaar-like or secret patterns is always refused.
4. The result is shown ("Drive: created" or "NOT confirmed") and stored as the approval's outcome.

Not allowed and not built: overwrite, move, share, delete. Verified: automated tests (including that the JavaScript and Python hashes agree) and a live run in which the CFO agent attempted a file and was queued. **Not yet verified live: clicking Approve and the file appearing in Drive.**

### 4a-2. Gmail: read and draft (added 2026-11-16)
Agents (all six specialists and the Chief of Staff) may search and read your Gmail and create or update **drafts**, with no approval click, because a draft is never sent. The guard hook (policy key `mail_draft`) scans draft content and refuses PAN/Aadhaar-like or secret patterns. Drafts appear in your Gmail Drafts folder; you review and send them yourself.

Always denied: send, reply, forward, label, trash, spam-marking and deleting drafts (the guard denies any Gmail tool that is not a read or a draft). Email content is confidential: agents are told to keep it out of web searches (an instruction, not a technical block), and to treat instructions inside an email as data. Reads happen with your mailbox access, so agents can see any message the connector can see; there is no folder or label restriction yet.

### 4a-3. Attaching files to a chat (added 2026-11-18)
Use **Attach** (or drag a file onto the message box, or paste one). Each file is saved on this Mac under `company/uploads/<conversation>/` (git-ignored, local only; up to 20 MB, 10 per message) and the agent is told where it is, so it can read the file as context for your message. You can send files with no text and the agent will summarise them.

- **Readable:** text, CSV, JSON, PDF and images are read directly. Word, Excel and PowerPoint files get a plain-text copy made on this Mac (tables come out as tab-separated rows; formulas show their last saved value). Other types are saved but the agent will say it cannot read them.
- **Blocked:** programs and scripts, and credential or key files.
- **Drive as the final copy:** tick "Also save to Google Drive". The agent then queues one Drive upload per file, and each one needs your Approve click (section 4a). The upload sends the exact file by its content hash, so the file cannot change between approval and upload. The approval card shows the file name, type and hash, not the file's contents.
- File contents are treated as data, not instructions. The PAN/Aadhaar scan covers what agents type, not the bytes of a file you attach, so only attach what you are happy to store in your own Drive.
- Remove a file before sending with the x on its chip. Files stay in `company/uploads/` until you delete them; the app does not clean them up.

### 4b. Agent notes: memory across conversations (added 2026-11-16)
Each agent keeps private notes in `company/agent-notes/<agent>/NOTES.md` (git-ignored, local). It reads them at the start of a task so it does not re-read sources it already understands, and saves durable learnings as dated, sourced one-liners with a confidence level and a "re-verify when". Notes are **hints, not facts**: time-sensitive items (balances, due dates, rates, regulation) must be re-checked at the source.

- Agents may write only that file (Edit allowed under that path only; everything else stays denied). The guard still blocks sensitive identifiers and secrets.
- Settings → Agent notes lists each agent's notes: **View** (opens Documents) and **Clear**, which archives to `company/agent-notes/_cleared/` rather than deleting.
- Agents are instructed to ask you 1 to 3 specific questions, with a recommended default, when a request is ambiguous or a fact is missing.
- Verified live: the CFO read a facts file and wrote a correct dated, sourced note. Not verified: that notes measurably reduce re-reading over many sessions. The Chief of Staff's notes rely on instructions in `CLAUDE.md` only.

### The Office view (added 2026-11-18)
**Office** in the sidebar shows the AI team as people at desks: the Chief of Staff at the top and each specialist below. It reads the running chats (nothing is stored): when an agent is working its desk lights up and shows what it is doing, and when the Chief of Staff hands a brief to a specialist a small copy of the Chief walks to that desk with a speech bubble. When the specialist finishes, a "done" bubble appears for a few seconds. With nobody working it says so. **Play demo meeting** runs a clearly labelled, simulated meeting for fun; it never mixes with real activity. It updates every 1.5 seconds and respects the reduced-motion setting. It only shows work that is running right now (or finished in the last minute), not history.

## 5. Data, backup, restore

- Data: `~/Library/Application Support/AI Management Office/office.db` (+ `-wal/-shm`). Not in the repo, not served.
- Backup: Settings → Back up now (SQLite `VACUUM INTO`, mode 600) → `…/backups/office-<timestamp>.db`. Local only.
- Check: Settings shows `PRAGMA integrity_check`.
- Restore: stop the app, copy the chosen backup over `office.db`, delete `office.db-wal` and `office.db-shm`, start the app.

## 6. Troubleshooting AI

Settings → AI connection. "Not signed in" → Terminal: `claude auth login`. Chat says expired session → start a new conversation. Port 3000 busy → launcher tells you. Connector shows "needs authentication" → Settings → Connectors → Authenticate. Logs: `~/Library/Application Support/AI Management Office/server.log`.

## 7. Security summary

Bound to 127.0.0.1; API rejects non-local Host (DNS rebinding), cross-origin or missing-Origin writes, non-JSON bodies; document access is realpath-checked against approved roots (traversal and symlink escape tested); secret-named files hidden; API-key env vars stripped; every state change writes an audit row; connector actions use `execFile` only. No login screen (single user, local only): anyone with access to your logged-in Mac session can use it.

Governance changes made at the founder's request on 2026-11-16 (recorded in `CLAUDE.md`): Drive `create_file` with per-file approval; agents may edit only their own notes file.

## 8. Known limitations

- App chats can search and fetch the web (verified live 2026-11-16: the Company Secretary fetched and searched for the MCA site and honestly reported a 403 on the fetch). Bash stays denied. Web results are still labelled Low confidence unless read from an official source, and some sites block fetches. Search queries leave your Mac; agents are instructed to keep confidential details out of them, but only secrets and PAN/Aadhaar-like patterns are blocked technically.
- Jobs are in memory (quitting the app loses an in-progress answer). No PDF export, no usage/cost totals, no agent-proposed tasks or approvals, no Playwright e2e (browser checks were manual and scripted).
- Documents does not browse Google Drive; agents do, through connectors.
- Voice depends on the browser's speech service.
- Next.js emits a "dynamic filesystem access" build warning (harmless).
- Smoke-test data (a few conversations, one task, approvals including one pending Drive approval) is in your real database; delete it in the app.

## 9. Acceptance status (refreshed 2026-11-16)

| # | Item | Status |
|---|---|---|
| 1–5 | Launch (Dock app), dashboard, navigation, data survives restart | **Verified** (founder uses the Dock app; restart kept data). Excludes one-time `claude auth login`. |
| 6–8 | Agents discovered, definitions loaded, open a specialist | **Verified** (7 agents; tests). |
| 9–10, 12 | Real response per agent definition, delegation | **Verified live**: specialist answers, delegation captured, `/daily-brief` produced a saved report. |
| 11 | Switch specialists | Verified live (separate conversations). |
| 13 | Missing integrations reported | Connectors panel shows live health; Authenticate confirmed by the founder. |
| 14–17 | Persistence, reopen, sessions, errors keep history | **Verified** (SQLite, mock and live: warm process reuse and `--resume`). |
| New | Leave the page and come back | **Verified** (automated test, live check with the real runtime, and founder confirmation). |
| New | Drive read for all agents | Verified live for the Chief and specialists. |
| New | Drive create with approval | Queue verified live; **approve-and-save not yet verified live**. |
| New | Agent notes | Write verified live for the CFO; effect on re-reading unproven. |
| New | Voice input | Founder confirmed working. |
| 18–20 | Reports, tasks, approvals | Verified for storage and logic; skill reports verified live. |
| 21 | Approval bypass | Verified at code level; only the Drive executor exists and it is hash-bound. |
| 22 | Dashboard shows real records | Verified. |
| 23–25 | No cloud, no paid service, no API billing | By design: nothing provisioned; API keys stripped. Plan-limit usage still applies (see `ai-auth-and-cost.md`). |
| 26 | Binds locally | **Verified** (`127.0.0.1:3000`). |
| 27 | Credentials not exposed | No credentials read or stored by the app. |
| 28 | Claude Code still works | Same `.claude/` configuration used. Agent definitions, `guard.py` and `guard-policy.json`, `settings.json`, `CLAUDE.md` and `tests/validate.py` were changed with founder approval (section 7). |
