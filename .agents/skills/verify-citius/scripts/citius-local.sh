#!/usr/bin/env bash
# Local verification instance control for the Citius website.
#
#   citius-local.sh launch [port]   start `next dev` on a private port and wait until usable
#   citius-local.sh doctor [port]   read-only check: is this instance ours and worth driving?
#   citius-local.sh stop   [port]   stop only the instance this script started; keep evidence
#
# It never starts `convex dev`, never pushes Convex functions, never seeds data, and never
# contacts Vercel. State lives in .scratch/verify-citius/ (git-ignored); evidence written
# there survives `stop`.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PORT="${2:-${CITIUS_VERIFY_PORT:-3117}}"
STATE="$ROOT/.scratch/verify-citius"
PIDFILE="$STATE/next-dev-$PORT.pid"
LOG="$STATE/next-dev-$PORT.log"
ORIGIN="http://localhost:$PORT"
mkdir -p "$STATE"
cd "$ROOT"

port_owner() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1; }

env_has() { grep -Eq "^$1=.+" .env.local 2>/dev/null; }

launch() {
  if [[ -n "$(port_owner)" ]]; then
    echo "refuse: port $PORT is already listening (pid $(port_owner)); pick another port or stop it" >&2
    exit 1
  fi
  if [[ ! -f .env.local ]]; then
    echo "refuse: .env.local is missing; copy it from the owner's checkout (never commit it)" >&2
    exit 1
  fi
  local agents_clean=0
  git diff --quiet -- AGENTS.md && agents_clean=1
  # Auth/app origins must name this port, or the browser fetches session state from :3000.
  (
    set -m
    SITE_URL="$ORIGIN" BETTER_AUTH_URL="$ORIGIN" NEXT_PUBLIC_APP_URL="$ORIGIN" \
      NEXT_PUBLIC_SITE_URL="$ORIGIN" nohup bun run dev -- --port "$PORT" >"$LOG" 2>&1 &
    echo $! >"$PIDFILE"
  )
  echo "started pid $(cat "$PIDFILE") on $ORIGIN, log $LOG"
  for _ in $(seq 1 120); do
    grep -q "Ready in" "$LOG" 2>/dev/null && break
    if grep -qE "EADDRINUSE|Failed to start" "$LOG" 2>/dev/null; then
      cat "$LOG" >&2
      exit 1
    fi
    sleep 1
  done
  # Ready means usable: the first request compiles the home route.
  local code
  code="$(curl -s -o /dev/null -m 180 -w '%{http_code}' "$ORIGIN/" || true)"
  echo "GET / -> $code"
  if [[ "$agents_clean" == 1 ]] && ! git diff --quiet -- AGENTS.md; then
    git checkout -- AGENTS.md
    echo "restored AGENTS.md (next dev rewrites its generated Next.js block)"
  fi
  [[ "$code" == 200 ]] || { echo "not usable yet; see $LOG" >&2; exit 1; }
}

doctor() {
  local fail=0
  echo "== repo doctor (no network, no deployment action)"
  bun run dev:doctor -- --profile public || echo "note: dev:doctor reported findings above"
  echo "== instance"
  local owner pid
  owner="$(port_owner)"
  pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -z "$owner" ]]; then
    echo "FAIL nothing listens on $PORT"
    exit 1
  fi
  if [[ -n "$pid" ]] && pgrep -g "$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')" >/dev/null 2>&1 \
    && pgrep -g "$(ps -o pgid= -p "$pid" | tr -d ' ')" | grep -qx "$owner"; then
    echo "ok   port $PORT is owned by this script's process group (leader $pid)"
  else
    echo "FAIL port $PORT is owned by pid $owner, not by an instance this script started; do not drive it"
    fail=1
  fi
  echo "ok   revision $(git rev-parse --short HEAD) dirty=$(git status --porcelain | grep -vc '^??' || true)"
  for key in NEXT_PUBLIC_CONVEX_URL NEXT_PUBLIC_SANITY_PROJECT_ID NEXT_PUBLIC_SANITY_DATASET; do
    if env_has "$key"; then echo "ok   .env.local names $key"; else echo "FAIL .env.local lacks $key"; fail=1; fi
  done
  grep -Eq '^CONVEX_DEPLOYMENT=dev:' .env.local && echo "ok   Convex target is a dev: deployment" \
    || { echo "FAIL CONVEX_DEPLOYMENT is not a dev: deployment"; fail=1; }
  local home account mcp
  home="$(curl -s -o /dev/null -m 120 -w '%{http_code}' "$ORIGIN/" || true)"
  account="$(curl -s -o /dev/null -m 120 -w '%{http_code} %{redirect_url}' "$ORIGIN/account" || true)"
  echo "$([[ "$home" == 200 ]] && echo ok || echo FAIL)   GET / -> $home"
  echo "$([[ "$account" == "307 $ORIGIN/auth/guest" ]] && echo ok || echo FAIL)   GET /account -> $account"
  mcp="$(curl -s -m 30 -X POST "$ORIGIN/_next/mcp" -H 'content-type: application/json' \
    -H 'accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_compilation_issues","arguments":{}}}' \
    | sed -n 's/^data: //p' || true)"
  if [[ -n "$mcp" ]]; then echo "ok   /_next/mcp get_compilation_issues: ${mcp:0:300}"; else echo "FAIL /_next/mcp unreachable"; fail=1; fi
  [[ "$home" == 200 && "$account" == "307 $ORIGIN/auth/guest" ]] || fail=1
  exit "$fail"
}

stop() {
  local pid
  pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    echo "no pid file for port $PORT; nothing this script started is running"
  else
    local pgid
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
    if [[ -n "$pgid" ]]; then
      kill -TERM -- "-$pgid" 2>/dev/null || true
      sleep 2
      kill -KILL -- "-$pgid" 2>/dev/null || true
      echo "stopped process group $pgid (leader $pid)"
    else
      echo "pid $pid already exited"
    fi
    rm -f "$PIDFILE"
  fi
  for session in citius-browser-smoke-public "${AGENT_BROWSER_SESSION:-}"; do
    [[ -n "$session" ]] && agent-browser --session "$session" close >/dev/null 2>&1 || true
  done
  [[ -z "$(port_owner)" ]] && echo "port $PORT is free" || echo "port $PORT still has a listener: $(port_owner)"
  # The Playwright HTML report bundles third-party JS that React Doctor scans and scores down;
  # traces and screenshots under .scratch/e2e-public/results stay as evidence.
  if [[ -d .scratch/e2e-public/report ]]; then
    rm -rf .scratch/e2e-public/report node_modules/.cache/react-doctor
    echo "removed .scratch/e2e-public/report (viewer bundle) and the React Doctor scan cache"
  fi
  git diff --quiet -- AGENTS.md || echo "warning: AGENTS.md is modified; restore it unless you changed it on purpose"
  echo "evidence kept under $STATE, .scratch/browser-smoke, .scratch/e2e-public"
}

case "${1:-}" in
  launch) launch ;;
  doctor) doctor ;;
  stop) stop ;;
  *) sed -n '2,11p' "$0"; exit 2 ;;
esac
