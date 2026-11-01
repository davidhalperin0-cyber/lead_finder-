import call_brief as cb


FACTS = "שם העסק: פוטו עדן\nדירוג בגוגל: 4.1 מתוך 5, על סמך 138 ביקורות"


def test_number_from_facts_is_allowed():
    brief = {"opener": "ראיתי שיש לכם 138 ביקורות"}
    assert cb.ungrounded_numbers(brief, FACTS) == []


def test_invented_number_is_caught():
    brief = {"reason": "כבר 15 שנה בתחום, עם 2,500 לקוחות"}
    assert cb.ungrounded_numbers(brief, FACTS) == ["2500"]


def test_invented_number_in_objection_is_caught():
    brief = {"objections": [{"they_say": "יקר", "you_say": "זה עולה 990 בחודש"}]}
    assert cb.ungrounded_numbers(brief, FACTS) == ["990"]


def test_small_numbers_are_not_facts():
    brief = {"opener": "תנו לי 30 שניות", "reason": "שיחה של 15 דקות, 2-3 שאלות"}
    assert cb.ungrounded_numbers(brief, FACTS) == []


def test_only_real_quotes_survive():
    reviews = [{"text": "שירות מדהים! מהיר, איכפתי, מושקע"}]
    items = [
        {"point": "שירות מהיר", "quote": "מהיר, איכפתי"},
        {"point": "מחירים זולים", "quote": "הכי זול בעיר"},
    ]
    assert cb.keep_real_quotes(items, reviews) == [{"point": "שירות מהיר", "quote": "מהיר, איכפתי"}]


def test_unknown_product_falls_back_and_price_comes_from_code():
    b = cb.normalize_brief({"product": "app", "objections": [{"they_say": "x", "you_say": ""}]}, [])
    assert b["product"] == "business"
    assert b["from_price"] == cb.PRODUCTS["business"][1]
    assert b["objections"] == []


def test_same_business_by_phone():
    lead = {"business_name": "משהו אחר", "phone": "050-123-4567"}
    place = {"displayName": {"text": "שם שונה"}, "nationalPhoneNumber": "050-1234567"}
    assert cb._same_business(lead, place)


def test_different_business_rejected():
    lead = {"business_name": "מספרת רונית", "phone": "050-1111111"}
    place = {"displayName": {"text": "פיצה האט"}, "nationalPhoneNumber": "03-9999999"}
    assert not cb._same_business(lead, place)
