#!/bin/bash
# Stops AI Management Office (only the process this launcher started, plus anything listening on 3000 that identifies as this app).
DATA="$HOME/Library/Application Support/AI Management Office"
PIDFILE="$DATA/server.pid"
stopped=0
if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE")"
  # npm spawns children: stop the whole group started by the launcher
  pkill -TERM -P "$PID" 2>/dev/null; kill -TERM "$PID" 2>/dev/null && stopped=1
  rm -f "$PIDFILE"
fi
if curl -fs --max-time 2 http://localhost:3000/api/health 2>/dev/null | grep -q '"version"'; then
  for p in $(lsof -nP -tiTCP:3000 -sTCP:LISTEN 2>/dev/null); do kill -TERM "$p" 2>/dev/null && stopped=1; done
fi
sleep 1
if [ "$stopped" = 1 ]; then echo "AI Management Office stopped."; else echo "It was not running."; fi
