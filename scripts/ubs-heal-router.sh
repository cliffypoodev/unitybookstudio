#!/bin/bash
# ROUTERHEAL-3 / ROUTERSPLIT-1 — out-of-process recovery for the UBS-ONLY router.
#
# Runs DETACHED from the dev server: the heal endpoint fires this and returns
# immediately, so nothing here can stall or kill UBS itself. (2026-08-04: the
# in-process heal died mid-request and took the dev server down with it, losing
# a finished chapter that had nowhere left to save.)
#
# SCOPE IS DELIBERATELY NARROW. UBS owns the router on 8081 and nothing else.
# This script only ever touches the process listening on 8081 and that
# process's own descendants. It never runs a broad "kill any llama process"
# sweep, because this machine also runs a shared router on 8080 and an
# assistant on 1237 whose workers look identical in ps output.
PORT="${UBS_LLAMA_PORT:-8081}"
LOG="${UBS_LLAMA_LOG:-/Users/cliff/Library/Logs/ubs-llama-router.log}"
HEAL_LOG=/tmp/ubs-heal.log
LAUNCH="${UBS_LLAMA_LAUNCH:-/Users/cliff/.local/bin/llama serve --models-dir /Users/cliff/llama-models --models-max 1 --models-autoload --host 127.0.0.1 --port 8081 --ctx-size 65536 --parallel 1 --cache-ram 0}"

echo "=== $(date) heal start (port $PORT) ===" >> "$HEAL_LOG"

# Refuse to run against any port that is not ours.
if [ "$PORT" = "8080" ] || [ "$PORT" = "1237" ]; then
  echo "REFUSING: $PORT is not the UBS router" >> "$HEAL_LOG"; exit 1
fi

if curl -s --max-time 5 "localhost:$PORT/v1/models" | grep -q '"data"'; then
  echo "already serving - no action" >> "$HEAL_LOG"; exit 0
fi

kill_tree() {
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  echo "killing $1" >> "$HEAL_LOG"; kill "$1" 2>/dev/null
}
for pid in $(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null); do kill_tree "$pid"; done

# Wait for the socket to actually be released (a fixed sleep loses this race).
for _ in $(seq 1 20); do
  [ -z "$(lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null)" ] && break
  sleep 1
done

nohup $LAUNCH >> "$LOG" 2>&1 &
echo "relaunched pid $!" >> "$HEAL_LOG"

# Poll until it truly serves; a cold 35B load takes far longer than any fixed sleep.
for _ in $(seq 1 45); do
  if curl -s --max-time 5 "localhost:$PORT/v1/models" | grep -q '"data"'; then
    echo "router serving again" >> "$HEAL_LOG"; exit 0
  fi
  sleep 2
done
echo "router did NOT come back within 90s" >> "$HEAL_LOG"
exit 1
