#!/bin/bash
# לחיצה כפולה ב-Mac פותחת את הדשבורד בדפדפן
cd "$(dirname "$0")" || exit 1
exec streamlit run dashboard.py
