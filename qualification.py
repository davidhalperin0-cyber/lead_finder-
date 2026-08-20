"""
הכשרת ליד — האם שווה לאשת המכירות להרים טלפון.

כל האותות כאן מגיעים מנתונים שכבר שילמנו עליהם ב-Google Places, ולא
מסקרייפינג של רשתות חברתיות. אינסטגרם ופייסבוק מגישים מעטפת JavaScript
ריקה לבקשה לא מאומתת, וכל ניסיון לחלץ משם עוקבים או תאריך פוסט אחרון
נשבר בלי להודיע — ואז השדות מתמלאים בזבל בשקט. עדיף אות אמין ודל מאות
עשיר ומומצא.

מודול טהור: בלי רשת, בלי I/O.
"""
from __future__ import annotations

import re

# ----- חיוּת העסק -----
STRONG = "strong"      # עסק פעיל ומבוסס
OK = "ok"              # פעיל
WEAK = "weak"          # סימני חיים מעטים
UNKNOWN = "unknown"    # אין מספיק מידע

#: מספרי שירות ארציים — כמעט תמיד רשת, מוקד או חברה גדולה.
#: לא עסק שבעליו ירים טלפון וישמע הצעה לאתר.
_SERVICE_PREFIXES = ("1700", "1800", "1599", "1555", "1900", "153", "159")


def is_service_number(phone: str) -> bool:
    """האם זה מספר שירות ארצי ולא קו של עסק מקומי."""
    raw = (phone or "").strip()
    # מספרי כוכבית (*6070) הם תמיד מוקדים מסחריים
    if raw.startswith("*"):
        return True
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return False
    if digits.startswith("972"):
        digits = "0" + digits[3:]
    digits = digits.lstrip("0") or digits
    return digits.startswith(_SERVICE_PREFIXES)


def business_liveness(review_count, rating=None) -> str:
    """
    מעריך עד כמה העסק חי, לפי מספר הביקורות בגוגל.

    מספר הביקורות הוא האות היציב ביותר שיש לנו: אנשים לא כותבים ביקורות
    על עסק סגור. הדירוג עצמו פחות מעניין — עסק עם 2 כוכבים הוא עדיין ליד
    מצוין (ואולי אפילו טוב יותר, יש לו מה לשפר).
    """
    try:
        n = int(review_count or 0)
    except (TypeError, ValueError):
        n = 0
    if n >= 20:
        return STRONG
    if n >= 5:
        return OK
    if n >= 1:
        return WEAK
    return UNKNOWN


def is_worth_calling(*, liveness: str, phone: str, is_chain: bool = False) -> bool:
    """
    שער אחרון לפני שליד מגיע אליה.

    פוסל רק מה שוודאי בזבוז זמן — סניף רשת, ומספר שירות ארצי.
    עסק עם מעט ביקורות עדיין עובר: הוא אולי חדש, וזה דווקא לקוח מצוין.
    """
    if is_chain:
        return False
    if is_service_number(phone):
        return False
    return True


def call_priority(*, liveness: str, has_social: bool, web_category: str = "") -> int:
    """
    ציון 0-100 לסדר החיוג. גבוה = להתקשר קודם.

    ההיגיון: עסק חי שקיים רק באינסטגרם הוא הליד הטוב ביותר — יש לו לקוחות,
    יש לו תוכן, ואין לו איפה לשלוח אותם. השיחה כותבת את עצמה.
    """
    score = {STRONG: 60, OK: 45, WEAK: 25, UNKNOWN: 15}.get(liveness, 15)
    if has_social:
        score += 25          # יש נכס דיגיטלי פעיל — קל להראות לו מה חסר
    if web_category == "none":
        score += 10          # אין לו כלום בכלל
    return max(0, min(100, score))
