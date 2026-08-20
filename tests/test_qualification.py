"""בדיקות להכשרת לידים."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from qualification import (
    OK,
    STRONG,
    UNKNOWN,
    WEAK,
    business_liveness,
    call_priority,
    is_service_number,
    is_worth_calling,
)


# ------------------------------------------------------ מספרי שירות
@pytest.mark.parametrize("phone", [
    "1-700-509-501",   # נמדד בפועל: "שניר ומאיר - סניף נורדאו"
    "1700509501",
    "1-800-123-456",
    "1599-000-111",
    "*6070",           # מוקד מסחרי
])
def test_service_numbers_flagged(phone):
    assert is_service_number(phone)


@pytest.mark.parametrize("phone", [
    "03-685-8282",     # מספרים אמיתיים שנמדדו
    "052-275-0776",
    "+972-50-223-6630",
    "04-862-3193",
])
def test_local_numbers_not_flagged(phone):
    assert not is_service_number(phone)


def test_service_number_handles_empty():
    assert not is_service_number("")
    assert not is_service_number(None)


# ------------------------------------------------------------ חיוּת
@pytest.mark.parametrize("count,expected", [
    (250, STRONG), (20, STRONG),
    (19, OK), (5, OK),
    (4, WEAK), (1, WEAK),
    (0, UNKNOWN), (None, UNKNOWN), ("", UNKNOWN), ("לא מספר", UNKNOWN),
])
def test_business_liveness(count, expected):
    assert business_liveness(count) == expected


def test_low_rating_still_counts_as_alive():
    """עסק עם דירוג גרוע הוא ליד מצוין — יש לו מה לתקן."""
    assert business_liveness(80, rating=2.1) == STRONG


# --------------------------------------------------- שער "שווה לחייג"
def test_chain_branch_is_rejected():
    assert not is_worth_calling(liveness=STRONG, phone="03-1234567", is_chain=True)


def test_service_number_is_rejected():
    assert not is_worth_calling(liveness=STRONG, phone="1-700-509-501")


def test_new_business_with_few_reviews_still_passes():
    """עסק חדש הוא לקוח מצוין — לא לפסול אותו."""
    assert is_worth_calling(liveness=WEAK, phone="052-275-0776")
    assert is_worth_calling(liveness=UNKNOWN, phone="03-685-8282")


# ------------------------------------------------------ סדר החיוג
def test_live_instagram_business_ranks_highest():
    """הליד המועדף: עסק חי שקיים רק באינסטגרם."""
    insta = call_priority(liveness=STRONG, has_social=True)
    quiet = call_priority(liveness=UNKNOWN, has_social=False)
    assert insta > quiet
    assert insta >= 80


def test_priority_stays_in_range():
    for lv in (STRONG, OK, WEAK, UNKNOWN):
        for soc in (True, False):
            for cat in ("none", "social_only", ""):
                p = call_priority(liveness=lv, has_social=soc, web_category=cat)
                assert 0 <= p <= 100
