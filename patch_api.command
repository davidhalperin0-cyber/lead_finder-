#!/bin/bash
# ============================================================
#  Lead Finder — Patch API venv
#  מתקין את החבילות החסרות ב-api/.venv (bs4, requests, וכו')
#  הפעלה: דאבל-קליק
# ============================================================

set -u

cd "$(dirname "$0")" || { echo "Cannot cd to project dir"; exit 1; }
PROJECT_DIR="$(pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

clear
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Lead Finder — Patch API                ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo

# --- Stop running services first to avoid file lock issues ---
echo -e "${CYAN}[1/3] עוצר שירותים שרצים (אם יש)...${NC}"
for port in 8000 3000 8501; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  סוגר תהליך על פורט $port"
    echo "$pids" | xargs -r kill -9 2>/dev/null
  fi
done
sleep 1
echo -e "  ${GREEN}✓ פורטים פנויים${NC}"

# --- Check api/.venv exists ---
if [ ! -x "$PROJECT_DIR/api/.venv/bin/pip" ]; then
  echo -e "${RED}✗ לא נמצא api/.venv${NC}"
  echo -e "${YELLOW}הריצי קודם את fix_and_install.command${NC}"
  echo "לחצי Enter לסגירה..."
  read -r
  exit 1
fi

# --- Install missing packages ---
echo
echo -e "${CYAN}[2/3] מתקין חבילות חסרות ב-api/.venv...${NC}"
cd "$PROJECT_DIR/api" || exit 1
source .venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt
deactivate
cd "$PROJECT_DIR" || exit 1
echo -e "  ${GREEN}✓ הותקנו${NC}"

# --- Verify import works ---
echo
echo -e "${CYAN}[3/3] בודק שהייבוא עובד...${NC}"
cd "$PROJECT_DIR/api" || exit 1
source .venv/bin/activate
if python -c "import sys; sys.path.insert(0, '..'); from find_leads import run_pipeline" 2>&1 | tee /tmp/lead_finder_check.log; then
  if [ ! -s /tmp/lead_finder_check.log ]; then
    echo -e "  ${GREEN}✓ הייבוא עובד${NC}"
  fi
fi
deactivate

echo
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✓ ה-API תוקן!                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo
echo -e "${CYAN}עכשיו דאבל-קליק על start_all.command כדי להפעיל את הכל מחדש.${NC}"
echo
echo "לחצי Enter לסגירה..."
read -r
