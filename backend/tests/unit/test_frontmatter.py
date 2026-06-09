from src.util.frontmatter import parse_front_matter


def test_no_front_matter_returns_raw_body():
    meta, body = parse_front_matter("just a body")
    assert meta == {}
    assert body == "just a body"


def test_parses_keys_and_strips_block():
    raw = "---\npatient_id: abc-123\nred_flag: true\n---\n# Title\n\nBody text."
    meta, body = parse_front_matter(raw)
    assert meta["patient_id"] == "abc-123"
    assert meta["red_flag"] == "true"
    assert body.startswith("# Title")
    assert "patient_id" not in body


def test_unterminated_front_matter_returns_raw():
    raw = "---\nkey: value\nno closing delimiter"
    meta, body = parse_front_matter(raw)
    assert meta == {}
    assert body == raw
