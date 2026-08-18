#!/bin/sh
set -eu
cd /workspace

CLOCK_PID=/tmp/league-clock.pid
if [ ! -f "$CLOCK_PID" ] || ! kill -0 "$(cat "$CLOCK_PID")" 2>/dev/null; then
  (
    while true; do
      sleep 180
      curl -sf -o /dev/null --max-time 20 http://127.0.0.1:8080/api/league/tick || true
    done
  ) >>/tmp/league-clock.log 2>&1 &
  echo $! > "$CLOCK_PID"
fi

if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
bun run dev >>/tmp/app-startup.log 2>&1 &
