"""
דוגמת אתר לליד — דף אמיתי שהמוכרת שולחת אחרי השיחה ("ככה זה יכול להיראות אצלכם").

נבנה מנתוני גוגל של העסק (תמונות, ביקורות, שעות, דירוג), כך שכל דוגמה אישית.
העיקרון של המערכת נשמר: אין טקסט ממוצא. הכותרת והנקודות נכתבות רק מתוך
הביקורות, וכל מה שלא מאומת יורד.
"""

from __future__ import annotations

import json
import os
import re
import sys
from typing import Optional

import requests

from call_brief import _same_business

DEMO_VERSION = 1

_FIELDS = (
    "places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,"
    "places.primaryTypeDisplayName,places.primaryType,places.types,places.rating,places.userRatingCount,"
    "places.formattedAddress,places.shortFormattedAddress,places.googleMapsUri,"
    "places.regularOpeningHours,places.reviews,places.photos"
)

# ערכת צבע לפי סוג העסק. מפתח = מילה שמופיעה בסוג של גוגל.
_THEMES = [
    (("beauty", "hair", "nail", "spa", "barber", "salon", "cosmet"), "beauty"),
    (("restaurant", "cafe", "bakery", "food", "bar", "meal", "pizza", "coffee"), "food"),
    (("dentist", "doctor", "clinic", "health", "physio", "medical", "pharmacy", "veterin"), "health"),
    (("car", "auto", "garage", "motor", "tire"), "auto"),
    (("lawyer", "account", "insurance", "real_estate", "finance", "consult"), "pro"),
    (("store", "shop", "jewel", "cloth", "furniture", "florist", "electronics"), "shop"),
]


def _theme(types: list[str]) -> str:
    joined = " ".join(types).lower()
    for keys, name in _THEMES:
        if any(k in joined for k in keys):
            return name
    return "pro"


def _photo_uris(api_key: str, photos: list[dict], limit: int = 6) -> list[str]:
    """כתובות תמונה ציבוריות (בלי המפתח שלנו בדף)."""
    out = []
    for ph in photos[:limit]:
        name = ph.get("name")
        if not name:
            continue
        try:
            r = requests.get(
                f"https://places.googleapis.com/v1/{name}/media",
                params={"maxWidthPx": 1600, "skipHttpRedirect": "true", "key": api_key},
                timeout=10,
            )
            uri = r.json().get("photoUri") if r.status_code == 200 else None
            if uri:
                out.append(uri)
        except Exception:
            continue
    return out


def fetch_place(lead: dict) -> dict:
    api_key = (os.environ.get("GOOGLE_PLACES_API_KEY") or "").strip()
    name = (lead.get("business_name") or "").strip()
    if not api_key or not name:
        return {}
    query = " ".join(x for x in [name, lead.get("address") or lead.get("search_city") or ""] if x)
    try:
        r = requests.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={"Content-Type": "application/json", "X-Goog-Api-Key": api_key, "X-Goog-FieldMask": _FIELDS},
            json={"textQuery": query, "languageCode": "he", "regionCode": "IL", "pageSize": 3},
            timeout=15,
        )
        if r.status_code != 200:
            print(f"  demo: Places {r.status_code}: {r.text[:200]}", file=sys.stderr)
            return {}
        places = r.json().get("places") or []
    except Exception as e:
        print(f"  demo: Places request failed: {e}", file=sys.stderr)
        return {}
    place = next((p for p in places if _same_business(lead, p)), None)
    if not place:
        return {}
    place["_photo_uris"] = _photo_uris(api_key, place.get("photos") or [])
    return place


def _reviews(place: dict) -> list[dict]:
    out = []
    for rv in place.get("reviews") or []:
        text = ((rv.get("text") or {}).get("text") or "").strip()
        if not text or (rv.get("rating") or 0) < 4:
            continue
        author = ((rv.get("authorAttribution") or {}).get("displayName") or "").split(" ")[0]
        out.append({"text": text[:260] + ("…" if len(text) > 260 else ""), "full": text, "author": author, "rating": rv.get("rating")})
    return out[:3]


_COPY_PROMPT = """את קופירייטרית של אתרים לעסקים קטנים בישראל. כתבי טקסט קצר לדף הבית של העסק, רק מתוך הביקורות.
החזירי JSON: {"headline": "עד 7 מילים", "subline": "עד 14 מילים", "points": [{"title": "עד 3 מילים", "text": "עד 12 מילים", "quote": "2-6 מילים מדויקות מביקורת"}]}
- 3 נקודות, כל אחת על משהו שלקוחות באמת כותבים. quote חייב להיות העתקה מדויקת מאחת הביקורות.
- אסור להמציא שירותים, מחירים, שנות ותק או מספרים. אסור סופרלטיבים ריקים ("הטובים בישראל").
- עברית טבעית, פנייה ללקוח של העסק, בלי "פתרון", "חוויה בלתי נשכחת", "ערך מוסף"."""


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[\"'״׳.,!?…:;()\-–—]", " ", s or "")).strip()


def _copy(name: str, type_label: str, reviews: list[dict]) -> dict:
    """כותרת ונקודות מתוך הביקורות. נכשל בשקט — הדף עובד גם בלי."""
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key or not reviews:
        return {}
    try:
        from openai import OpenAI

        facts = f"שם העסק: {name}\nסוג: {type_label}\nביקורות:\n" + "\n".join(f"- {r['full']}" for r in reviews)
        resp = OpenAI(api_key=key).chat.completions.create(
            model=os.environ.get("OPENAI_DEMO_MODEL", "gpt-5.4-mini"),
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": _COPY_PROMPT}, {"role": "user", "content": facts}],
            max_completion_tokens=1_500,
        )
        data = json.loads(resp.choices[0].message.content or "{}")
    except Exception as e:
        print(f"  demo: copy failed: {e}", file=sys.stderr)
        return {}
    corpus = _norm(" ".join(r["full"] for r in reviews))
    points = [
        {"title": str(p.get("title") or "").strip(), "text": str(p.get("text") or "").strip(), "quote": str(p.get("quote") or "").strip()}
        for p in data.get("points") or []
        if isinstance(p, dict) and _norm(str(p.get("quote") or "")) and _norm(str(p.get("quote"))) in corpus
    ]
    has_digits = lambda s: bool(re.search(r"\d", s))  # noqa: E731
    headline = str(data.get("headline") or "").strip()
    subline = str(data.get("subline") or "").strip()
    return {
        "headline": "" if has_digits(headline) else headline,
        "subline": "" if has_digits(subline) else subline,
        "points": [p for p in points if not has_digits(p["text"])][:3],
    }


def _wa(phone: str) -> str:
    d = re.sub(r"\D", "", phone or "")
    if d.startswith("0"):
        d = "972" + d[1:]
    return d if len(d) >= 11 else ""


def build_demo(lead: dict, place: Optional[dict] = None) -> dict:
    if place is None:
        place = fetch_place(lead)
    name = (place.get("displayName") or {}).get("text") or lead.get("business_name") or ""
    type_label = (place.get("primaryTypeDisplayName") or {}).get("text") or lead.get("search_business_type") or ""
    phone = place.get("nationalPhoneNumber") or lead.get("phone") or ""
    reviews = _reviews(place)
    return {
        "v": DEMO_VERSION,
        "name": name,
        "type_label": type_label,
        "city": lead.get("search_city") or "",
        "address": place.get("shortFormattedAddress") or place.get("formattedAddress") or lead.get("address") or "",
        "phone": phone,
        "whatsapp": _wa(lead.get("whatsapp") or phone),
        "maps_url": place.get("googleMapsUri") or "",
        "rating": place.get("rating"),
        "review_count": place.get("userRatingCount"),
        "hours": (place.get("regularOpeningHours") or {}).get("weekdayDescriptions") or [],
        # למבנה "פתוח עכשיו" בדף: [{open:{day,hour,minute}, close:{...}}], day 0 = ראשון
        "periods": (place.get("regularOpeningHours") or {}).get("periods") or [],
        "photos": place.get("_photo_uris") or [],
        "reviews": [{k: r[k] for k in ("text", "author", "rating")} for r in reviews],
        "theme": _theme([place.get("primaryType") or ""] + (place.get("types") or [])),
        "copy": _copy(name, type_label, reviews),
    }
