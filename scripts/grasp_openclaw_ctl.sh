#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="${GRASP_RUNTIME_DIR:-$ROOT_DIR/.runtime/openclaw}"
PROFILE_DIR="${GRASP_PROFILE_DIR:-/root/snap/chromium/common/grasp-openclaw-profile}"
LOG_DIR="$RUNTIME_DIR/logs"
PID_DIR="$RUNTIME_DIR/pids"
CHROME_LOG="$LOG_DIR/chromium.log"
GRASP_LOG="$LOG_DIR/grasp.log"
CHROME_PID_FILE="$PID_DIR/chromium.pid"
GRASP_PID_FILE="$PID_DIR/grasp.pid"
CHROME_BIN="${CHROME_BIN:-/usr/bin/chromium-browser}"
CDP_URL="${CHROME_CDP_URL:-http://127.0.0.1:9222}"
CDP_PORT="${CHROME_CDP_PORT:-9222}"

mkdir -p "$PROFILE_DIR" "$LOG_DIR" "$PID_DIR"

is_pid_running() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  local pid
  pid="$(cat "$file" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

start_chrome() {
  if is_pid_running "$CHROME_PID_FILE"; then
    return 0
  fi
  nohup "$CHROME_BIN" \
    --headless=new \
    --no-sandbox \
    --disable-dev-shm-usage \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port="$CDP_PORT" \
    --user-data-dir="$PROFILE_DIR" \
    about:blank \
    >"$CHROME_LOG" 2>&1 &
  echo $! > "$CHROME_PID_FILE"
}

wait_for_cdp() {
  for _ in $(seq 1 20); do
    if curl -fsS "$CDP_URL/json/version" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

start_grasp_probe() {
  if is_pid_running "$GRASP_PID_FILE"; then
    return 0
  fi
  nohup bash -lc "cd '$ROOT_DIR' && node index.js status" >"$GRASP_LOG" 2>&1 &
  echo $! > "$GRASP_PID_FILE"
}

cmd_start() {
  start_chrome
  if ! wait_for_cdp; then
    echo "CDP_UNREACHABLE"
    exit 1
  fi
  start_grasp_probe
  echo "started"
}

cmd_status() {
  echo "runtime_dir=$RUNTIME_DIR"
  echo "profile_dir=$PROFILE_DIR"
  echo "cdp_url=$CDP_URL"
  if is_pid_running "$CHROME_PID_FILE"; then
    echo "chromium=running"
  else
    echo "chromium=stopped"
  fi
  if curl -fsS "$CDP_URL/json/version" >/dev/null 2>&1; then
    echo "cdp=connected"
  else
    echo "cdp=disconnected"
  fi
  if is_pid_running "$GRASP_PID_FILE"; then
    echo "grasp_probe=running"
  else
    echo "grasp_probe=stopped"
  fi
  if [[ -f "$GRASP_LOG" ]]; then
    echo "--- grasp_status ---"
    tail -n 20 "$GRASP_LOG" || true
  fi
}

cmd_logs() {
  echo "--- chromium.log ---"
  tail -n 60 "$CHROME_LOG" 2>/dev/null || true
  echo
  echo "--- grasp.log ---"
  tail -n 60 "$GRASP_LOG" 2>/dev/null || true
}

cmd_stop() {
  if is_pid_running "$GRASP_PID_FILE"; then
    kill "$(cat "$GRASP_PID_FILE")" 2>/dev/null || true
  fi
  if is_pid_running "$CHROME_PID_FILE"; then
    kill "$(cat "$CHROME_PID_FILE")" 2>/dev/null || true
  fi
  rm -f "$GRASP_PID_FILE" "$CHROME_PID_FILE"
  echo "stopped"
}

case "${1:-status}" in
  start) cmd_start ;;
  status) cmd_status ;;
  logs) cmd_logs ;;
  stop) cmd_stop ;;
  *) echo "usage: $0 {start|status|logs|stop}" >&2; exit 2 ;;
esac
