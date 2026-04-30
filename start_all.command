#!/bin/bash
# ============================================================
#  Lead Finder — Start All Services (FastAPI + Next.js)
#  לחיצה כפולה במק תפעיל את שני השירותים, תפתח דפדפן, ותציג לוגים.
#  Ctrl+C יסגור את שניהם בצורה נקייה.
# ============================================================

set -u

# --- Move to project root (the directory of this script) ---
cd "$(dirname "$0")" || { echo "Cannot cd to project dir"; exit 1; }
PROJECT_DIR="$(pwd)"

# --- Colors for clarity ---
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

# --- Logs directory ---
LOG_DIR="$PROJECT_DIR/.logs"
mkdir -p "$LOG_DIR"
API_LOG="$LOG_DIR/api.log"
WEB_LOG="$LOG_DIR/web.log"

# --- PID file for cleanup ---
PIDS_FILE="$LOG_DIR/pids.txt"
> "$PIDS_FILE"

cleanup() {
  echo
  echo -e "${YELLOW}=== עוצר את כל השירותים... ===${NC}"
  if [ -s "$PIDS_FILE" ]; then
    while IFS= read -r pid; do
      [ -n "$pid" ] && kill "$pid" 2>/dev/null
    done < "$PIDS_FILE"
    sleep 1
    while IFS= read -r pid; do
      [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null
    done < "$PIDS_FILE"
  fi
  # Kill anything still bound to our ports as a safety net
  for port in 8000 3000; do
    lsof -ti :$port 2>/dev/null | xargs -r kill -9 2>/dev/null
  done
  echo -e "${GREEN}כל השירותים נעצרו.${NC}"
  exit 0
}
trap cleanup INT TERM

# --- Helper: free a port if something is already on it ---
free_port() {
  local port=$1; local name=$2
  local pids
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "${YELLOW}פורט $port (${name}) תפוס — סוגר תהליכים: $pids${NC}"
    echo "$pids" | xargs -r kill -9 2>/dev/null
    sleep 1
  fi
}

# --- Banner ---
clear
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Lead Finder — Starting Services        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo "Project: $PROJECT_DIR"
echo "Logs:    $LOG_DIR/"
echo

# --- 0) Free up ports ---
free_port 8000 "API"
free_port 3000 "Web"

# --- 1) Resolve Python venv for API ---
API_VENV="$PROJECT_DIR/api/.venv"

if [ ! -x "$API_VENV/bin/uvicorn" ]; then
  echo -e "${RED}לא נמצא uvicorn ב-api/.venv${NC}"
  echo -e "${YELLOW}הריצי קודם את fix_and_install.command${NC}"
  echo "לחצי Enter לסגירה..."
  read -r
  exit 1
fi

# --- 2) Ensure web/node_modules exists ---
if [ ! -d "$PROJECT_DIR/web/node_modules" ]; then
  echo -e "${RED}לא נמצא web/node_modules${NC}"
  echo -e "${YELLOW}הריצי קודם את fix_and_install.command${NC}"
  echo "לחצי Enter לסגירה..."
  read -r
  exit 1
fi

# --- 3) Start FastAPI ---
echo -e "${GREEN}[1/2] מפעיל FastAPI על http://localhost:8000${NC}"
(
  cd "$PROJECT_DIR/api" || exit 1
  # shellcheck disable=SC1091
  source .venv/bin/activate
  exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-dir . --reload-dir ..
) > "$API_LOG" 2>&1 &
echo $! >> "$PIDS_FILE"

# --- 4) Start Next.js ---
echo -e "${GREEN}[2/2] מפעיל Next.js על http://localhost:3000${NC}"
(
  cd "$PROJECT_DIR/web" || exit 1
  if command -v nvm >/dev/null 2>&1; then nvm use 2>/dev/null || true; fi
  exec npm run dev
) > "$WEB_LOG" 2>&1 &
echo $! >> "$PIDS_FILE"

# --- 5) Wait for ports to be live, then open browser tabs ---
wait_for_port() {
  local port=$1; local tries=120
  while [ $tries -gt 0 ]; do
    if lsof -i :$port >/dev/null 2>&1; then return 0; fi
    sleep 0.5
    tries=$((tries-1))
  done
  return 1
}

echo
echo -e "${CYAN}מחכה שהשירותים יעלו...${NC}"
wait_for_port 8000 && echo -e "  ${GREEN}✓ API   live${NC}"   || echo -e "  ${RED}✗ API   failed (ראי .logs/api.log)${NC}"
wait_for_port 3000 && echo -e "  ${GREEN}✓ Web   live${NC}"   || echo -e "  ${RED}✗ Web   failed (ראי .logs/web.log)${NC}"

# Open the main app tab only (no more API docs / Streamlit clutter)
sleep 1
open "http://localhost:3000" 2>/dev/null

echo
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  האפליקציה:  http://localhost:3000${NC}"
echo -e "${CYAN}════════════════════════════════════════════════${NC}"
echo
echo -e "${YELLOW}לחצי Ctrl+C (או דאבל-קליק על stop_all.command) כדי לעצור.${NC}"
echo

# Tail logs together until user kills
tail -f "$API_LOG" "$WEB_LOG"
