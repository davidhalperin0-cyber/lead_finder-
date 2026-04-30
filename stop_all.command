#!/bin/bash
# עוצר את כל שירותי Lead Finder (API + Web) שעלולים להישאר ברקע
cd "$(dirname "$0")" || exit 1

echo "עוצר שירותי Lead Finder..."
for port in 8000 3000; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  port $port  → killing $pids"
    echo "$pids" | xargs -r kill -9 2>/dev/null
  fi
done

# Also kill anything tracked by start_all.command
PIDS_FILE=".logs/pids.txt"
if [ -s "$PIDS_FILE" ]; then
  while IFS= read -r pid; do
    [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null
  done < "$PIDS_FILE"
  : > "$PIDS_FILE"
fi

echo "סיום."
