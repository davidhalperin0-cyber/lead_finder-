"""
כרטיס הכנה לשיחה — נבנה לכל ליד ברגע שהמוכרת פותחת אותו, לא בזמן הקציר.

למה ברגע הפתיחה ולא בקציר:
- עולה כסף רק על לידים שבאמת מתקשרים אליהם (לא על כל 60 התוצאות של חיפוש).
- שולף ביקורות ושעות פתיחה טריות מ-Google — החומר שהופך שיחה קרה לשיחה אישית.

עיקרון הברזל של המערכת נשמר כאן: ה-AI לא ממציא עובדות על העסק.
הוא מקבל בלוק עובדות מאומת, וכל מספר או ציטוט שהוא מחזיר נבדק מול הבלוק.
מבנה התסריט מבוסס על מחקר שיחות קרות (Gong, 300M שיחות; 30MPC):
פתיחה מהקשר + בקשת רשות, סיבת שיחה, בעיה במקום פיץ', בקשה קטנה ואז פגישה,
והתנגדויות בשיטת "מסכימה → פותחת שיחה → מציעה הצצה".
"""

from __future__ import annotations

import json
import os
import re
import sys
from typing import Any, Optional

import requests

# מה הסטודיו מוכר ומאיזה מחיר מותר לה להגיד. המחיר נקבע כאן בקוד, לא ב-AI.
PRODUCTS: dict[str, tuple[str, int]] = {
    "landing": ("דף נחיתה", 3_400),
    "business": ("אתר תדמית", 8_400),
    "refresh": ("חידוש האתר הקיים", 4_900),
    "store": ("חנות אונליין", 18_900),
    "booking": ("אתר עם זימון תורים אונליין", 8_400),
}

# מספרים קטנים (שעות, "2-3 שאלות") ומספרי התסריט עצמו ("30 שניות", "15 דקות")
# לא נחשבים עובדה על העסק.
_SMALL_NUMBER_LIMIT = 24
_SCRIPT_NUMBERS = {"30", "45"}


# ----------------------------------------------------------------------------
# עובדות מ-Google Places
# ----------------------------------------------------------------------------

def _digits(s: str) -> str:
    return re.sub(r"\D", "", s or "")


def _phone_key(phone: str) -> str:
    d = _digits(phone)
    if d.startswith("972"):
        d = "0" + d[3:]
    return d[-9:]


def _name_tokens(name: str) -> set[str]:
    clean = re.sub(r"[^\w\s]", " ", (name or "").lower())
    return {t for t in clean.split() if len(t) > 1}


def _same_business(lead: dict, place: dict) -> bool:
    """מוודא שהתוצאה מגוגל היא אותו עסק — אחרת נספר לה עובדות על עסק אחר."""
    lp = _phone_key(lead.get("phone") or "")
    pp = _phone_key(place.get("nationalPhoneNumber") or place.get("internationalPhoneNumber") or "")
    if lp and pp and lp == pp:
        return True
    a = _name_tokens(lead.get("business_name") or "")
    b = _name_tokens((place.get("displayName") or {}).get("text") or "")
    if not a or not b:
        return False
    return len(a & b) / len(a | b) >= 0.5


def fetch_place_context(lead: dict) -> dict:
    """
    שולף ביקורות, שעות פתיחה ותיאור מגוגל. בקשה אחת לליד.
    מחזיר {} אם אין מפתח, אם הבקשה נכשלה, או אם התוצאה לא אותו עסק.
    """
    api_key = (os.environ.get("GOOGLE_PLACES_API_KEY") or "").strip()
    name = (lead.get("business_name") or "").strip()
    if not api_key or not name:
        return {}
    query = " ".join(x for x in [name, lead.get("address") or lead.get("search_city") or ""] if x)
    field_mask = (
        "places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,"
        "places.primaryTypeDisplayName,places.rating,places.userRatingCount,"
        "places.editorialSummary,places.regularOpeningHours.weekdayDescriptions,places.reviews"
    )
    try:
        r = requests.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": field_mask,
            },
            json={"textQuery": query, "languageCode": "he", "regionCode": "IL", "pageSize": 3},
            timeout=15,
        )
        if r.status_code != 200:
            print(f"  call_brief: Places {r.status_code}: {r.text[:200]}", file=sys.stderr)
            return {}
        places = r.json().get("places") or []
    except Exception as e:
        print(f"  call_brief: Places request failed: {e}", file=sys.stderr)
        return {}

    place = next((p for p in places if _same_business(lead, p)), None)
    if not place:
        return {}

    reviews = []
    for rv in place.get("reviews") or []:
        text = ((rv.get("text") or {}).get("text") or "").strip()
        if text:
            reviews.append({
                "rating": rv.get("rating"),
                "when": rv.get("relativePublishTimeDescription") or "",
                "text": text[:600],
            })
    return {
        "type_label": (place.get("primaryTypeDisplayName") or {}).get("text") or "",
        "summary": (place.get("editorialSummary") or {}).get("text") or "",
        "hours": (place.get("regularOpeningHours") or {}).get("weekdayDescriptions") or [],
        "rating": place.get("rating"),
        "review_count": place.get("userRatingCount"),
        "reviews": reviews[:5],
    }


# ----------------------------------------------------------------------------
# בלוק העובדות — הדבר היחיד שה-AI מורשה לטעון על העסק
# ----------------------------------------------------------------------------

def _presence_line(lead: dict) -> str:
    social = (lead.get("social_url") or "").lower()
    if not lead.get("no_website"):
        return f"יש לעסק אתר: {lead.get('final_url') or lead.get('website') or ''}"
    if "instagram" in social:
        return "אין לעסק אתר. יש לו רק עמוד אינסטגרם."
    if "facebook" in social:
        return "אין לעסק אתר. יש לו רק עמוד פייסבוק."
    if "tiktok" in social:
        return "אין לעסק אתר. יש לו רק טיקטוק."
    return "אין לעסק אתר, ולא מצאנו לו עמוד ברשתות. קיים רק בגוגל מפות."


def build_facts(lead: dict, place: dict) -> str:
    lines = [f"שם העסק: {lead.get('business_name') or ''}"]
    kind = place.get("type_label") or lead.get("search_business_type") or ""
    if kind:
        lines.append(f"סוג העסק: {kind}")
    city = lead.get("search_city") or ""
    if city:
        lines.append(f"עיר: {city}")
    if lead.get("address"):
        lines.append(f"כתובת: {lead['address']}")
    lines.append(_presence_line(lead))

    rating = place.get("rating") or lead.get("google_rating")
    count = place.get("review_count") or lead.get("google_review_count")
    if count:
        lines.append(f"דירוג בגוגל: {float(rating or 0):.1f} מתוך 5, על סמך {int(count)} ביקורות")
    if place.get("summary"):
        lines.append(f"תיאור של גוגל: {place['summary']}")
    if place.get("hours"):
        lines.append("שעות פתיחה: " + " | ".join(place["hours"]))

    if not lead.get("no_website"):
        site = []
        if lead.get("strongest_problem"):
            site.append(f"הבעיה הבולטת באתר: {lead['strongest_problem']}")
        for p in (lead.get("main_problems") or [])[:4]:
            site.append(f"- {p}")
        if lead.get("is_mobile_friendly") is False:
            site.append("האתר לא מותאם לטלפון.")
        if lead.get("has_https") is False:
            site.append("האתר בלי מנעול אבטחה (HTTPS) — הדפדפן מסמן אותו 'לא מאובטח'.")
        if lead.get("last_copyright"):
            site.append(f"שנת זכויות יוצרים בתחתית האתר: {lead['last_copyright']}")
        if lead.get("domain_age_years"):
            site.append(f"גיל הדומיין: {lead['domain_age_years']} שנים")
        if site:
            lines.append("ממצאים מבדיקת האתר:\n" + "\n".join(site))

    reviews = place.get("reviews") or []
    if reviews:
        lines.append("ביקורות אמיתיות מגוגל (ציטוט מדויק):")
        for i, rv in enumerate(reviews, 1):
            lines.append(f"[{i}] ({rv.get('rating')}★, {rv.get('when')}) {rv['text']}")
    else:
        lines.append("אין בידינו טקסט של ביקורות.")
    return "\n".join(lines)


# ----------------------------------------------------------------------------
# הפרומפט
# ----------------------------------------------------------------------------

_SYSTEM = """את מאמנת מכירות טלפוניות בכירה בישראל. את מכינה את נציגת המכירות של סטודיו Halperin Designs לשיחה קרה אחת, לעסק אחד.

על הסטודיו: בונה אתרים בקוד מותאם (לא Wix ולא וורדפרס), בלי דמי פלטפורמה חודשיים, האתר והקוד שייכים ללקוח. הבעלים והמעצב הוא דוד. הנציגה לא סוגרת עסקאות ולא נותנת מחיר סופי — המטרה היחידה של השיחה: לקבוע שיחת היכרות של 15 דקות עם דוד.

הנציגה היא אישה ומדברת בגוף ראשון נקבה ("אני מתקשרת", "ראיתי"). את בעל/ת העסק פונים ברבים ("אצלכם", "יש לכם") כי לא יודעים מי יענה.

החזירי JSON תקף בלבד, במבנה הזה:
{
  "snapshot": "2-3 משפטים: מי העסק הזה, מה מיוחד בו, מה המצב שלו ברשת. רק עובדות מבלוק העובדות.",
  "customers_love": [{"point": "מה לקוחות אוהבים, במילים שלך", "quote": "ציטוט מדויק של 3-8 מילים מתוך אחת הביקורות"}],
  "angle": "משפט אחד: הסיבה הספציפית שהעסק הזה, ולא עסק כללי, מפסיד בלי אתר טוב. מבוסס על העובדות.",
  "product": "אחד מאלה בדיוק: landing | business | refresh | store | booking",
  "product_why": "משפט אחד למה דווקא זה מתאים להם",
  "best_time": "מתי עדיף להתקשר ומתי לא, לפי שעות הפתיחה וסוג העסק (למשל מסעדה: לא בשעות ארוחה). משפט אחד.",
  "before_dial": ["2-3 פעולות של 30 שניות לפני החיוג, ספציפיות לליד הזה"],
  "opener": "פתיחה",
  "reason": "סיבת השיחה + הבעיה",
  "questions": ["2-3 שאלות"],
  "small_ask": "בקשה קטנה",
  "meeting_ask": "קביעת השיחה עם דוד",
  "objections": [{"they_say": "התנגדות סבירה לעסק הזה", "you_say": "התשובה"}],
  "watch_out": ["1-3 דגשים ספציפיים לשיחה הזאת"]
}

איך בונים את התסריט — לפי מחקר על מאות מיליוני שיחות קרות:
1. opener — מתחילים מהקשר שלהם, לא מהשם שלנו: משהו אמיתי וספציפי עליהם (הביקורות, מה שלקוחות כותבים, האינסטגרם, ממצא מהאתר). אחר כך שם הנציגה והסטודיו. אחר כך מודים בכנות שזו שיחה לא צפויה, ומבקשים 30 שניות כשההחלטה נשארת אצלם. למשל: "...אני יודעת שאני מתפרצת לכם באמצע היום — תני/תן לי 30 שניות להגיד למה התקשרתי, ואז תחליטו אם להמשיך?" אסור לשאול "תפסתי אותך בזמן לא טוב?" (מוריד הצלחה ב-40%) ואסור "מה שלומך היום?" (נשמע כמו מוקד).
2. reason — מתחילים במילים "הסיבה שהתקשרתי" (פי 2.1 הצלחה). מתארים סצנה חיה וקונקרטית של הבעיה מנקודת המבט של הלקוח שלהם: מי מחפש, איפה, מה הוא רואה, מה הוא עושה בסוף (הולך למתחרה). ואז משפט פתרון אחד: "אנחנו בונים לעסקים כמו שלכם X, כדי ש-Y". מדברים על הבעיה, לא על טכנולוגיה — שפת בעיה מצליחה פי 3 משפת מוצר.
3. questions — 2-3 שאלות פתוחות וקלות, שנוגעות בבעיה שתיארת ונותנות להם לדבר. לא חקירה.
4. small_ask — בקשת עניין קטנה לפני פגישה, כי פגישה מרגישה כבדה: "שווה לכם לראות איך זה יכול להיראות אצלכם?"
5. meeting_ask — מציעה שתי אפשרויות זמן לשיחה של 15 דקות עם דוד, לא שאלת כן/לא. אפשרויות כלליות ("מחר בבוקר או ביום רביעי אחר הצהריים"), אף פעם לא שעה מדויקת — את השעה המדויקת היא מתאמת מול היומן של דוד.
6. objections — 4-5 התנגדויות שהעסק הזה באמת צפוי להגיד (למשל עסק עם אינסטגרם חזק: "יש לי אינסטגרם, זה מספיק"). כל תשובה בשלושה צעדים: מסכימה ומכבדת ("לגמרי מבינה"), שואלת שאלה קצרה שפותחת אותם לדבר, ומציעה הצצה בלי התחייבות במקום למכור. אף פעם לא מתווכחת.
7. watch_out — דגשים לשיחה הזאת דווקא (מתי לשתוק, מה לא להגיד, מה הנקודה הרגישה).

חוקי ניסוח:
- עברית מדוברת של ישראלית בת 30 בטלפון. משפטים קצרים. בלי "פתרון מקיף", "ערך מוסף", "נוכחות דיגיטלית", "טכנולוגיה מתקדמת".
- המילים המדויקות שהיא אומרת, לא הוראות ("תציגי את עצמך" — אסור). במקום שמה כתבי [השם שלך].
- כשפונים לבעלים ביחיד, כתבי את שתי הצורות עם לוכסן (תן/תני), או השתמשי ברבים.
- opener + reason ביחד: עד 45 שניות דיבור.

חוק עובדות (הכי חשוב):
- כל טענה על העסק חייבת להופיע בבלוק העובדות. אסור להמציא מספרים, שמות, מנות, שירותים, שעות או ציטוטים.
- אסור לנקוב בשם של שירות או מוצר ספציפי (למשל "הלבנת שיניים", "תספורת גברים") אם הוא לא כתוב בבלוק. כשצריך דוגמה, השתמשי בסוג העסק הכללי ("מי שמחפש רופא שיניים").
- כל מספר שאת כותבת על העסק (ביקורות, דירוג, שנים) חייב להופיע בבלוק כמו שהוא.
- customers_love: רק אם יש טקסט ביקורות. "quote" חייב להיות העתקה מדויקת מתוך ביקורת. אין ביקורות — מערך ריק.
- אסור לנקוב במחיר, בזמן אספקה או בהבטחה לתוצאה (מקום ראשון בגוגל, כמות לקוחות)."""


# ----------------------------------------------------------------------------
# בדיקת עיגון — אף מספר ואף ציטוט לא מומצאים
# ----------------------------------------------------------------------------

_SCRIPT_FIELDS = ("snapshot", "angle", "opener", "reason", "small_ask", "product_why")


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[\"'״׳.,!?…:;()\-–—]", " ", s or "")).strip()


def _numbers(text: str) -> set[str]:
    return {n.replace(",", "") for n in re.findall(r"\d[\d,]*(?:\.\d+)?", text or "")}


def ungrounded_numbers(brief: dict, facts: str) -> list[str]:
    """מספרים שה-AI כתב על העסק ושלא מופיעים בעובדות."""
    allowed = _numbers(facts)
    text = " ".join(str(brief.get(k) or "") for k in _SCRIPT_FIELDS)
    text += " " + " ".join(str(o.get("you_say") or "") for o in brief.get("objections") or [])
    bad = []
    for n in sorted(_numbers(text)):
        try:
            if float(n) <= _SMALL_NUMBER_LIMIT:
                continue
        except ValueError:
            continue
        if n not in allowed and n not in _SCRIPT_NUMBERS:
            bad.append(n)
    return bad


def keep_real_quotes(items: list, reviews: list[dict]) -> list[dict]:
    corpus = _norm(" ".join(r.get("text") or "" for r in reviews))
    out = []
    for it in items or []:
        if not isinstance(it, dict):
            continue
        quote = str(it.get("quote") or "").strip()
        point = str(it.get("point") or "").strip()
        if quote and point and _norm(quote) and _norm(quote) in corpus:
            out.append({"point": point, "quote": quote})
    return out[:3]


def _str_list(v: Any, limit: int) -> list[str]:
    return [str(x).strip() for x in (v or []) if str(x).strip()][:limit] if isinstance(v, list) else []


def normalize_brief(data: dict, reviews: list[dict]) -> dict:
    product = str(data.get("product") or "").strip()
    if product not in PRODUCTS:
        product = "business"
    label, from_price = PRODUCTS[product]
    objections = []
    for o in data.get("objections") or []:
        if isinstance(o, dict) and str(o.get("they_say") or "").strip() and str(o.get("you_say") or "").strip():
            objections.append({"they_say": str(o["they_say"]).strip(), "you_say": str(o["you_say"]).strip()})
    return {
        "snapshot": str(data.get("snapshot") or "").strip(),
        "customers_love": keep_real_quotes(data.get("customers_love") or [], reviews),
        "angle": str(data.get("angle") or "").strip(),
        "product": product,
        "product_label": label,
        "from_price": from_price,
        "product_why": str(data.get("product_why") or "").strip(),
        "best_time": str(data.get("best_time") or "").strip(),
        "before_dial": _str_list(data.get("before_dial"), 3),
        "opener": str(data.get("opener") or "").strip(),
        "reason": str(data.get("reason") or "").strip(),
        "questions": _str_list(data.get("questions"), 3),
        "small_ask": str(data.get("small_ask") or "").strip(),
        "meeting_ask": str(data.get("meeting_ask") or "").strip(),
        "objections": objections[:5],
        "watch_out": _str_list(data.get("watch_out"), 3),
    }


# ----------------------------------------------------------------------------
# יצירה
# ----------------------------------------------------------------------------

def _ask_model(client, model: str, facts: str, feedback: str = "") -> dict:
    user = f"בלוק העובדות על העסק:\n---\n{facts}\n---"
    if feedback:
        user += f"\n\n{feedback}"
    resp = client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": _SYSTEM}, {"role": "user", "content": user}],
        max_completion_tokens=6_000,
        # מהירות: המוכרת מחכה מול המסך. הסגנון מגיע מהפרומפט, לא מעומק החשיבה.
        reasoning_effort=os.environ.get("OPENAI_PREP_EFFORT", "low"),
    )
    return json.loads((resp.choices[0].message.content or "{}").strip())


def generate_brief(lead: dict, place: Optional[dict] = None) -> dict:
    """
    בונה כרטיס הכנה לליד. מרים RuntimeError עם הודעה בעברית אם אי אפשר.
    `place` = תוצאת fetch_place_context (אם None — נשלף כאן).
    """
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise RuntimeError("חסר OPENAI_API_KEY")
    from openai import OpenAI

    if place is None:
        place = fetch_place_context(lead)
    facts = build_facts(lead, place)
    reviews = place.get("reviews") or []

    client = OpenAI(api_key=key)
    model = os.environ.get("OPENAI_PREP_MODEL", "gpt-5.4")
    data = _ask_model(client, model, facts)
    bad = ungrounded_numbers(data, facts)
    if bad:
        data = _ask_model(
            client, model, facts,
            feedback=(
                f"בגרסה הקודמת כתבת את המספרים {', '.join(bad)} שלא מופיעים בעובדות. "
                "כתבי מחדש בלי שום מספר שלא מופיע בבלוק."
            ),
        )
        bad = ungrounded_numbers(data, facts)

    brief = normalize_brief(data, reviews)
    brief["facts_used"] = {
        "reviews": len(reviews),
        "has_hours": bool(place.get("hours")),
        "google_matched": bool(place),
    }
    brief["warnings"] = [f"מספר לא מאומת בתסריט: {n} — לא לצטט אותו" for n in bad]
    brief["model"] = model
    return brief


def brief_to_legacy_fields(brief: dict) -> dict:
    """ממפה את הכרטיס לעמודות התסריט הישנות, כדי שכל מסך קיים יציג את הגרסה החדשה."""
    return {
        "script_intro": brief["opener"],
        "script_value_pitch": brief["reason"],
        "script_discovery": brief["questions"],
        "script_offer": brief["small_ask"],
        "script_close": brief["meeting_ask"],
        "script_objections": {o["they_say"]: o["you_say"] for o in brief["objections"]},
        "script_dos_and_donts": brief["watch_out"],
        "suggested_angle": brief["angle"],
        "what_to_offer": f"{brief['product_label']} (החל מ-{brief['from_price']:,} ₪ + מע״מ) — {brief['product_why']}",
    }
