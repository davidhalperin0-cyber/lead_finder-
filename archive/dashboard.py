#!/usr/bin/env python3
"""
דשבורד להפעלה קלה — נפתח בדפדפן, בלי שורות פקודה.

הרצה:
    cd תיקיית הפרויקט
    pip install -r requirements.txt
    streamlit run dashboard.py

או לחיצה כפולה על run_dashboard.command (Mac).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import streamlit as st

from find_leads import (
    NoBusinessesFound,
    _load_env_file,
    generate_call_prep,
    run_pipeline,
)

_load_env_file()

st.set_page_config(
    page_title="Lead Finder",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("חיפוש לידים + הכנה לשיחה")
st.caption(
    "כלי עזר אנושי בלבד — לא שולח הודעות אוטומטית. מלאי .env עם OPENAI_API_KEY לניתוח AI."
)

if "last_result" not in st.session_state:
    st.session_state.last_result = None

with st.sidebar:
    st.header("חיפוש")
    city = st.text_input("עיר", value="תל אביב")
    business_type = st.text_input(
        "סוג עסק",
        value="מסעדה",
        help="לדוגמה: מסעדה, עורך דין, מספרה, רופא שיניים",
    )
    limit = st.number_input("כמה לידים", min_value=1, max_value=80, value=10, step=1)
    workers = st.slider("מקביליות (מהירות מול API)", min_value=1, max_value=10, value=4)
    use_ai = st.checkbox("ניתוח AI (דורש מפתח ב-.env)", value=True)
    export_html = st.checkbox("ליצור גם קובץ HTML (דשבורד מלא בקובץ)", value=True)
    screenshots = st.checkbox("צילומי מסך (Playwright — אופציונלי)", value=False)

    run_clicked = st.button("הרץ חיפוש", type="primary", use_container_width=True)

    if use_ai and not (os.environ.get("OPENAI_API_KEY") or "").strip():
        st.sidebar.warning("חסר OPENAI_API_KEY ב-.env — הניתוח ידולג או בטלי ניתוח AI.")

if run_clicked:
    st.session_state.last_result = None
    prog = st.progress(0.0, text="מתחיל…")
    log = st.empty()

    def on_progress(i: int, n: int, lead) -> None:
        prog.progress(min(i / max(n, 1), 1.0), text=f"{i}/{n} — {lead.business_name[:40]}")
        log.caption(f"סורק: **{lead.business_name}**")

    try:
        res = run_pipeline(
            city=city.strip(),
            business_type=business_type.strip(),
            limit=int(limit),
            workers=int(workers),
            export_html=export_html,
            use_ai=use_ai,
            screenshots=screenshots,
            on_progress=on_progress,
            quiet=True,
        )
        st.session_state.last_result = res
        prog.progress(1.0, text="סיום")
        st.success("החיפוש הסתיים. הטבלה והפירוט למטה.")
    except NoBusinessesFound as e:
        st.error(str(e))
    except Exception as e:
        st.error(f"שגיאה: {e}")
        raise
    finally:
        prog.empty()
        log.empty()

res = st.session_state.last_result
if res:
    stats = res["stats"]
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("סה״כ לידים", stats["total"])
    m2.metric("ציון F (ישנים מאוד)", stats["grade_f"])
    m3.metric("ציון D", stats["grade_d"])
    m4.metric("עם טלפון/מייל", stats["with_contact"])

    st.divider()
    fp_xlsx = Path(res["out_xlsx"])
    if fp_xlsx.is_file():
        st.download_button(
            label="הורדת קובץ אקסל",
            data=fp_xlsx.read_bytes(),
            file_name=fp_xlsx.name,
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    html_path = res.get("out_html")
    if html_path and Path(html_path).is_file():
        st.info(
            f"נוצר גם דף HTML מלא (רשימה + תצוגה + העתקה): `{html_path}` — "
            "לחצי כפולה על הקובץ בפיינדר או גררי לכרום."
        )
        try:
            uri = Path(html_path).as_uri()
            st.markdown(f"[פתיחה בדפדפן]({uri})")
        except Exception:
            pass

    st.subheader("טבלת לידים (סיכום)")
    leads = sorted(res["leads"], key=lambda x: x.score, reverse=True)
    table_rows = []
    for L in leads:
        table_rows.append(
            {
                "שם": L.business_name,
                "ציון": L.score,
                "אות": L.grade,
                "עדיפות": L.priority_level,
                "טלפון": L.phone,
                "אתר": L.final_url or L.website,
                "נקודת שיחה (קצר)": (L.best_talking_point or "")[:80],
            }
        )
    st.dataframe(table_rows, use_container_width=True, hide_index=True)

    st.subheader("פירוט ליד — הכנה לשיחה")
    labels = [
        f"{L.business_name}  ·  {L.grade}/{L.score}  ·  {L.priority_level or '—'}"
        for L in leads
    ]
    pick = st.selectbox("בחרי ליד", range(len(leads)), format_func=lambda i: labels[i])
    L = leads[pick]

    c1, c2 = st.columns(2)
    with c1:
        st.markdown(f"**אתר:** [{L.final_url or L.website}]({L.final_url or L.website})")
        st.markdown(f"**ציון:** {L.score} · **אות:** {L.grade} · **עדיפות:** {L.priority_level}")
        if L.ai_summary:
            st.markdown("**סיכום AI:**")
            st.write(L.ai_summary)
        if L.ai_notes:
            st.warning(L.ai_notes)
    with c2:
        url = L.final_url or L.website or ""
        if url:
            try:
                import streamlit.components.v1 as components

                components.iframe(url, height=420, scrolling=True)
            except Exception:
                st.caption("תצוגה מקדימה: פתחי את הקישור בלשונית חדשה")

    if L.main_problems:
        st.markdown("**בעיות מרכזיות:**")
        for p in L.main_problems[:5]:
            st.markdown(f"- {p}")

    st.markdown("### תיבת הכנה לשיחה")
    prep = generate_call_prep(L)
    st.text_area("העתיקי לוואטסאפ / מסמך", prep, height=220, key=f"prep_{pick}")

    tp = (L.best_talking_point or "").strip()
    if tp:
        st.text_input("נקודת שיחה (משפט אחד)", tp, key=f"tp_{pick}")
        st.caption("העתיקי מהשדה למעלה או מתוך תיבת ההכנה.")

else:
    st.info('בחרי הגדרות בסרגל הצד ולחצי **"הרץ חיפוש"**.')
