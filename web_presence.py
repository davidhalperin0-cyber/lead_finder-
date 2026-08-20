"""
סיווג נוכחות דיגיטלית של עסק.

הבעיה שזה פותר: `websiteUri` של Google הוא שדה אחד, אבל הוא מכיל חמישה
דברים שונים לגמרי — אתר עצמאי, דף אינסטגרם, רישום ב-zap, אתר של רשת,
או דומיין מת. בדיקה בינארית ("יש ערך / אין ערך") זורקת את הלידים הטובים
ביותר (עסק שקיים רק באינסטגרם) ומכניסה את הגרועים ביותר (סניף של רשת).

המודול הזה טהור — בלי רשת, בלי I/O. אפשר לבדוק אותו במלואו.
"""
from __future__ import annotations

from urllib.parse import urlparse

# ----- קטגוריות -----
NONE = "none"                    # אין קישור בכלל
SOCIAL_ONLY = "social_only"      # רק אינסטגרם/פייסבוק/טיקטוק/לינקטרי
AGGREGATOR = "aggregator"        # רישום באתר צד ג' (zap, easy, wolt)
CHAIN_CORPORATE = "chain_corporate"  # דומיין שמשותף להרבה סניפים
OWN_SITE = "own_site"            # אתר עצמאי

#: קטגוריות שמשמעותן "לעסק הזה אין אתר משלו" — קהל היעד למכירת אתר.
NO_WEBSITE_CATEGORIES = frozenset({NONE, SOCIAL_ONLY, AGGREGATOR})

_SOCIAL_HOSTS = frozenset({
    "instagram.com", "facebook.com", "fb.com", "fb.me", "messenger.com",
    "tiktok.com", "linktr.ee", "linktree.com", "wa.me", "whatsapp.com",
    "api.whatsapp.com", "t.me", "telegram.me", "twitter.com", "x.com",
    "linkedin.com", "youtube.com", "youtu.be", "pinterest.com", "snapchat.com",
})

_AGGREGATOR_HOSTS = frozenset({
    "easy.co.il", "b144.co.il", "144.co.il", "d.co.il", "zap.co.il",
    "rest.co.il", "restaurants.co.il", "rol.co.il", "mouse.co.il",
    "wolt.com", "10bis.co.il", "tenbis.co.il", "mysupermarket.co.il",
    "tripadvisor.com", "tripadvisor.co.il", "yelp.com", "lametayel.co.il",
    "google.com", "goo.gl", "maps.app.goo.gl", "business.site",
    "wikipedia.org", "ynet.co.il", "walla.co.il", "mako.co.il",
})

#: בוני-אתרים שמארחים תת-דומיין לכל לקוח. הדומיין הראשי משותף להמון
#: עסקים, אז אסור לספור אותו כ"רשת" — אבל תת-דומיין הוא אתר עצמאי לגיטימי.
_SITE_BUILDER_HOSTS = frozenset({
    "wixsite.com", "wix.com", "squarespace.com", "weebly.com",
    "shopify.com", "myshopify.com", "webflow.io", "netlify.app",
    "vercel.app", "github.io", "blogspot.com", "wordpress.com",
    "co.business.site", "ravpage.co.il", "nadlan.com",
})


def host_of(url: str) -> str:
    """מחזיר את הדומיין הנקי (בלי www, בלי פורט, אותיות קטנות)."""
    u = (url or "").strip()
    if not u:
        return ""
    if "://" not in u:
        u = "http://" + u
    try:
        host = (urlparse(u).netloc or "").lower()
    except Exception:
        return ""
    host = host.split("@")[-1].split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    return host


def registrable_domain(url: str) -> str:
    """
    הדומיין שאפשר לספור עליו "רשת".

    לאתרי בונים מחזיר את התת-דומיין המלא (`salon.wixsite.com`), כדי ששני
    עסקים שונים ב-Wix לא ייחשבו לאותה רשת.
    """
    host = host_of(url)
    if not host:
        return ""
    for builder in _SITE_BUILDER_HOSTS:
        if host == builder or host.endswith("." + builder):
            return host
    return host


def _matches(host: str, hosts: frozenset) -> bool:
    return any(host == h or host.endswith("." + h) for h in hosts)


def classify(url: str, *, chain_domains: frozenset | set | None = None) -> str:
    """
    מסווג קישור יחיד לאחת מחמש הקטגוריות.

    `chain_domains` — דומיינים שכבר ידועים כשייכים לרשת. ראה `find_chain_domains`.
    """
    host = host_of(url)
    if not host:
        return NONE
    if _matches(host, _SOCIAL_HOSTS):
        return SOCIAL_ONLY
    if _matches(host, _AGGREGATOR_HOSTS):
        return AGGREGATOR
    if chain_domains and registrable_domain(url) in chain_domains:
        return CHAIN_CORPORATE
    return OWN_SITE


def is_no_website(category: str) -> bool:
    """האם הקטגוריה מייצגת עסק שאין לו אתר משלו."""
    return category in NO_WEBSITE_CATEGORIES


def find_chain_domains(urls, *, min_branches: int = 6) -> set:
    """
    מזהה רשתות: דומיין שחוזר אצל `min_branches` עסקים או יותר.

    זה הפתרון ל"בעיית ארומה" — כל סניפי ארומה מצביעים על aroma.co.il,
    אז הדומיין חוצה את הסף ומסומן כרשת. עסק עם 2-3 סניפים לא חוצה אותו
    ונשאר ליד לגיטימי, כי שם הבעלים עדיין עונה לטלפון.

    אתרי בונים (Wix וכו') לא נספרים — הם מארחים אלפי עסקים עצמאיים.
    """
    counts: dict[str, int] = {}
    for u in urls:
        host = host_of(u)
        if not host or _matches(host, _SOCIAL_HOSTS) or _matches(host, _AGGREGATOR_HOSTS):
            continue
        d = registrable_domain(u)
        if not d:
            continue
        counts[d] = counts.get(d, 0) + 1
    return {d for d, n in counts.items() if n >= min_branches}


def normalize_brand(name: str) -> str:
    """
    מנרמל שם עסק למפתח מותג.

    "ארומה תל אביב — סניף דיזנגוף" ו-"ארומה אספרסו בר, רמת גן" מתכווצים
    למפתחות שמתחילים שניהם ב-"ארומה", כדי ש-`brand_matches` יזהה אותם
    כאותה רשת.
    """
    import re

    s = (name or "").strip().lower()
    # קודם חותכים ב"סניף" — הוא הסימן החזק ביותר, וקודם לכל מפריד אחר
    s = re.split(r"\s+סניף\b", s)[0]
    s = re.split(r"\s*[-–—|,()]\s*", s)[0]
    noise = (
        "בע\"מ", "בעמ", "ltd", "inc", "llc",
        "תל אביב", "תל־אביב", "ירושלים", "חיפה", "רמת גן", "פתח תקווה",
        "ראשון לציון", "באר שבע", "נתניה", "חולון", "בת ים", "הרצליה",
        "ישראל", "israel",
    )
    for w in noise:
        s = s.replace(w, " ")
    s = re.sub(r"[^\w\u0590-\u05ff]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def brand_matches(candidate_name: str, suppressed_brand: str) -> bool:
    """
    האם שם עסק שייך למותג מושתק.

    התאמה היא תחילית על גבול מילה, לא שוויון: מחיקת "ארומה" חוסמת גם
    "ארומה אספרסו בר". מפתח קצר מ-3 תווים לא מתאים לאף אחד — הוא כללי
    מדי ויחסום עסקים שאין להם קשר.
    """
    key = (suppressed_brand or "").strip()
    cand = normalize_brand(candidate_name)
    if len(key) < 3 or not cand:
        return False
    if cand == key:
        return True
    return cand.startswith(key + " ") or key.startswith(cand + " ")
