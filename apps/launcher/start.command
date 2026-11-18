#!/bin/bash
# AI Management Office launcher. Double-click to start and open the app.
# Local only: binds to 127.0.0.1:3000. Safe to run twice (no duplicate servers).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/../web"
DATA="$HOME/Library/Application Support/AI Management Office"
PIDFILE="$DATA/server.pid"
LOG="$DATA/server.log"
URL="http://localhost:3000"
mkdir -p "$DATA"; chmod 700 "$DATA"
# Finder-launched apps get a minimal PATH; make sure Node and the Claude Code CLI are findable.
export PATH="$HOME/.local/bin:$HOME/.claude/local:/opt/homebrew/bin:/usr/local/bin:$PATH"

say_err() { echo "ERROR: $1"; osascript -e "display dialog \"$1\" buttons {\"OK\"} with title \"AI Management Office\" with icon caution" >/dev/null 2>&1; exit 1; }
healthy() { curl -fs --max-time 2 "$URL/api/health" 2>/dev/null | grep -q '"version"'; }

if healthy; then echo "Already running."; open "$URL"; exit 0; fi

if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  say_err "Port 3000 is used by another program. Close it (or run stop.command if it is an old copy) and try again."
fi

command -v node >/dev/null 2>&1 || say_err "Node.js was not found. Install Node.js 24 or newer, then try again."
[ -d "$APP/node_modules" ] || say_err "Dependencies are missing. In Terminal run: cd apps/web && npm install"

cd "$APP" || say_err "Application folder not found."
if [ ! -d .next ]; then echo "First run: building (about a minute)..."; npm run build >"$LOG" 2>&1 || say_err "Build failed. See $LOG"; fi

# New session (setsid) so the server survives when the launcher app/Terminal window closes.
nohup perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' npm run start >"$LOG" 2>&1 &
echo $! >"$PIDFILE"

for i in $(seq 1 60); do
  if healthy; then echo "Ready."; open "$URL"; exit 0; fi
  sleep 1
done
say_err "The app did not start within 60 seconds. See $LOG"
