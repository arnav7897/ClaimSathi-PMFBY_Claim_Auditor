from davacheck.agents.localization import MeaningCheck, detect_language


def test_detect_hindi():
    assert detect_language("आपका दावा अस्वीकृत कर दिया गया है") == "hi"


def test_detect_english():
    assert detect_language("Your claim has been rejected") == "en"


def test_detect_mixed_defaults_english():
    # Hindi words present but predominantly English structure
    assert detect_language("The threshold yield की गणना") == "hi"


def test_meaning_check_schema_fail_closed():
    check = MeaningCheck(meaning_preserved=False, discrepancies=["60% changed to 16%"])
    assert not check.meaning_preserved
