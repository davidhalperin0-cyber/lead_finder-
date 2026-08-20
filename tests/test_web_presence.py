"""בדיקות לסיווג נוכחות דיגיטלית. הרצה:  python3 -m pytest tests/ -q"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from web_presence import (
    AGGREGATOR,
    CHAIN_CORPORATE,
    NONE,
    OWN_SITE,
    SOCIAL_ONLY,
    classify,
    find_chain_domains,
    host_of,
    is_no_website,
    normalize_brand,
    registrable_domain,
)


# ---------------------------------------------------------------- host_of
@pytest.mark.parametrize("url,expected", [
    ("https://www.Example.co.il/path?q=1", "example.co.il"),
    ("example.co.il", "example.co.il"),
    ("http://sub.example.com:8080/x", "sub.example.com"),
    ("", ""),
    ("   ", ""),
    (None, ""),
    ("not a url at all", "not a url at all"),  # לא קורס
])
def test_host_of(url, expected):
    assert host_of(url) == expected


# --------------------------------------------------------------- classify
@pytest.mark.parametrize("url,expected", [
    # מקרים אמיתיים שנמדדו מול Google Places — אלה נזרקו לפח במערכת הישנה
    ("https://www.instagram.com/studiohafif?igsh=d29s", SOCIAL_ONLY),
    ("https://www.tiktok.com/@bshar.idreas?_r=1", SOCIAL_ONLY),
    ("https://www.facebook.com/maayanhabira/", SOCIAL_ONLY),
    ("http://www.instagram.com/ram.solan", SOCIAL_ONLY),
    # אתרים עצמאיים אמיתיים שנמדדו — אלה קהל "אתר מיושן"
    ("https://mentortlv.com/", OWN_SITE),
    ("https://cut-shave.com/", OWN_SITE),
    ("https://masperanyc.co.il/", OWN_SITE),
    # אגרגטורים
    ("https://www.easy.co.il/biz/12345", AGGREGATOR),
    ("https://rest.co.il/rest/999", AGGREGATOR),
    ("https://wolt.com/he/isr/tel-aviv/x", AGGREGATOR),
    ("https://maps.app.goo.gl/abc", AGGREGATOR),
    # ריק
    ("", NONE),
    (None, NONE),
])
def test_classify(url, expected):
    assert classify(url) == expected


def test_subdomains_inherit_category():
    assert classify("https://m.facebook.com/x") == SOCIAL_ONLY
    assert classify("https://business.easy.co.il/y") == AGGREGATOR


def test_chain_domain_is_flagged_only_when_known():
    url = "https://aroma.co.il/branch/dizengoff"
    assert classify(url) == OWN_SITE
    assert classify(url, chain_domains={"aroma.co.il"}) == CHAIN_CORPORATE


# --------------------------------------------------- קהל היעד "בלי אתר"
def test_no_website_segment_membership():
    assert is_no_website(NONE)
    assert is_no_website(SOCIAL_ONLY)      # הליד שהמערכת הישנה זרקה
    assert is_no_website(AGGREGATOR)
    assert not is_no_website(OWN_SITE)
    assert not is_no_website(CHAIN_CORPORATE)   # ארומה לא ליד


# ------------------------------------------------------- זיהוי רשתות
def test_chain_detected_above_threshold():
    """בעיית ארומה: הרבה סניפים, דומיין אחד."""
    urls = [f"https://aroma.co.il/branch/{i}" for i in range(7)]
    assert find_chain_domains(urls) == {"aroma.co.il"}


def test_small_business_with_few_branches_is_not_a_chain():
    """מאפייה עם 3 סניפים — הבעלים עונה לטלפון, זה ליד."""
    urls = [f"https://mybakery.co.il/{i}" for i in range(3)]
    assert find_chain_domains(urls) == set()


def test_threshold_is_configurable():
    urls = [f"https://x.co.il/{i}" for i in range(3)]
    assert find_chain_domains(urls, min_branches=3) == {"x.co.il"}


def test_site_builders_are_never_chains():
    """אלף עסקים ב-Wix הם לא רשת אחת."""
    urls = [f"https://shop{i}.wixsite.com/home" for i in range(20)]
    assert find_chain_domains(urls) == set()


def test_social_hosts_are_never_chains():
    """מאה עסקים באינסטגרם הם לא רשת."""
    urls = [f"https://instagram.com/biz{i}" for i in range(30)]
    assert find_chain_domains(urls) == set()


def test_registrable_domain_keeps_builder_subdomain():
    assert registrable_domain("https://salon.wixsite.com/x") == "salon.wixsite.com"
    assert registrable_domain("https://www.aroma.co.il/x") == "aroma.co.il"


# --------------------------------------------------------- נרמול מותג
def test_normalize_brand_collapses_branches():
    a = normalize_brand("שניר ומאיר - סניף נורדאו")
    b = normalize_brand("שניר ומאיר סניף דיזנגוף")
    assert a == b != ""


def test_normalize_brand_handles_empty():
    assert normalize_brand("") == ""
    assert normalize_brand(None) == ""
