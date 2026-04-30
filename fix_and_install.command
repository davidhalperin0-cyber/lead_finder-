#!/bin/bash
# ============================================================
#  Lead Finder — Fix & Reinstall
#  בונה מחדש את כל הסביבות (api venv, root venv, node_modules)
#  הפעלה: דאבל-קליק
# ============================================================

set -u

cd "$(dirname "$0")" || { echo "Cannot cd to project dir"; exit 1; }
PROJECT_DIR="$(pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

clear
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       Lead Finder — Fix & Reinstall          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo "Project: $PROJECT_DIR"
echo

# --- Step 0: Find a good Python (3.10+) ---
echo -e "${CYAN}[0/4] בודק את Python...${NC}"
PYTHON_BIN=""
for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$candidate" >/dev/null 2>&1; then
    VERSION=$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)
    MAJOR=$(echo "$VERSION" | cut -d. -f1)
    MINOR=$(echo "$VERSION" | cut -d. -f2)
    if [ "$MAJOR" -ge 3 ] && [ "$MINOR" -ge 10 ]; then
      PYTHON_BIN="$candidate"
      echo -e "  ${GREEN}✓ נמצא $candidate (גרסה $VERSION)${NC}"
      break
    fi
  fi
done

if [ -z "$PYTHON_BIN" ]; then
  echo -e "${RED}✗ לא נמצא Python 3.10 ומעלה.${NC}"
  echo -e "${YELLOW}התקיני Python מ-https://www.python.org/downloads/ ונסי שוב.${NC}"
  echo "(אפשר גם דרך Homebrew: brew install python@3.12)"
  echo
  echo "לחצי Enter לסגירה..."
  read -r
  exit 1
fi

# --- Step 1: Rebuild api/.venv ---
echo
echo -e "${CYAN}[1/4] בונה מחדש api/.venv ...${NC}"
rm -rf "$PROJECT_DIR/api/.venv"
cd "$PROJECT_DIR/api" || exit 1
"$PYTHON_BIN" -m venv .venv
source .venv/bin/activate
pip install --upgrade pip --quiet
pip install -r requirements.txt
deactivate
cd "$PROJECT_DIR" || exit 1
echo -e "  ${GREEN}✓ api/.venv מוכן${NC}"

# --- Step 2: Skip root .venv — לא משתמשים יותר ב-Streamlit/CLI ---
echo
echo -e "${CYAN}[2/4] (מדלג על .venv ראשי - לא בשימוש)${NC}"

# --- Step 3: Check Node version ---
echo
echo -e "${CYAN}[3/4] בודק את Node.js...${NC}"
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}✗ Node.js לא מותקן.${NC}"
  echo -e "${YELLOW}התקיני Node 20 מ-https://nodejs.org או דרך Homebrew: brew install node@20${NC}"
  echo "לחצי Enter לסגירה..."
  read -r
  exit 1
fi

NODE_VER=$(node -v)
echo "  גרסת Node: $NODE_VER"
NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -ge 24 ]; then
  echo -e "  ${YELLOW}⚠ Node $NODE_MAJOR עלול לגרום לבעיות עם Next.js. מומלץ Node 20 LTS.${NC}"
  echo -e "  ${YELLOW}  אם יש לך nvm: 'nvm install 20 && nvm use 20'${NC}"
  echo -e "  ${YELLOW}  ממשיך בכל זאת...${NC}"
fi

# --- Step 4: Rebuild node_modules ---
echo
echo -e "${CYAN}[4/4] מתקין מחדש node_modules ב-web/ (יכול לקחת 1-3 דקות) ...${NC}"
cd "$PROJECT_DIR/web" || exit 1
rm -rf node_modules package-lock.json
if command -v nvm >/dev/null 2>&1; then nvm use 2>/dev/null || true; fi
npm install
cd "$PROJECT_DIR" || exit 1
echo -e "  ${GREEN}✓ node_modules מוכן${NC}"

# --- Done ---
echo
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✓ הכל הותקן בהצלחה!                 ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo
echo -e "${CYAN}עכשיו עשי דאבל-קליק על start_all.command כדי להפעיל את הכל.${NC}"
echo
echo "לחצי Enter לסגירה..."
read -r
