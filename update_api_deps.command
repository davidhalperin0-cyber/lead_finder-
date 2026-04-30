#!/bin/bash
# ============================================================
#  Lead Finder — Update API dependencies
#  מעדכן את ספריות ה-API בלי לבנות venv מחדש
#  הפעלה: דאבל-קליק (כשהשירותים סגורים)
# ============================================================

set -u

cd "$(dirname "$0")" || { echo "Cannot cd to project dir"; exit 1; }
PROJECT_DIR="$(pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

clear
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Lead Finder — Update API Deps          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo

# --- Stop services first ---
echo -e "${CYAN}[1/2] עוצר שירותים שרצים (אם יש)...${NC}"
for port in 8000 3000; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  סוגר תהליך על פורט $port"
    echo "$pids" | xargs -r kill -9 2>/dev/null
  fi
done
sleep 1
echo -e "  ${GREEN}✓${NC}"

# --- Update API venv ---
if [ ! -x "$PROJECT_DIR/api/.venv/bin/pip" ]; then
  echo -e "${RED}✗ לא נמצא api/.venv${NC}"
  echo -e "${YELLOW}הריצי קודם את fix_and_install.command${NC}"
  echo "לחצי Enter לסגירה..."
  read -r
  exit 1
fi

echo
echo -e "${CYAN}[2/2] מעדכן ספריות API...${NC}"
cd "$PROJECT_DIR/api" || exit 1
source .venv/bin/activate
pip install --upgrade pip --quiet
pip install --upgrade -r requirements.txt
deactivate
cd "$PROJECT_DIR" || exit 1

echo
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✓ הספריות עודכנו!                    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo
echo -e "${CYAN}עכשיו דאבל-קליק על start_all.command${NC}"
echo
echo "לחצי Enter לסגירה..."
read -r
