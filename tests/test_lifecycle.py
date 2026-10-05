"""Publishing a rule, filing a report that freezes content, ruling, appeal, finality."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from conftest import advance, load_contract, reset  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
mod = load_contract(ROOT)
gl = sys.modules["genlayer"]

DEPLOYER = "0x9999999999999999999999999999999999999999"
AUTHOR = "0x1111111111111111111111111111111111111111"
REPORTER = "0x2222222222222222222222222222222222222222"
POSTER = "0x3333333333333333333333333333333333333333"
STRANGER = "0x4444444444444444444444444444444444444444"

URL = "https://forum.example/t/881"
RULE = "No advertising of paid services, referral codes or discount codes in the forum."
CLAIM = "The post advertises a paid follower service with a discount code."
HOUR = 3600
DAY = 86400
K = "forum/no-ads"
R = "case-1"


def _bench(delay=str(HOUR), window=str(DAY)):
    """Deploy from one account, publish the rule from another."""
    reset(gl)
    gl.message.sender_address = DEPLOYER
    c = mod.RuleBench()
    gl.message.sender_address = AUTHOR
    c.publish_rule(K, "No advertising", RULE, delay, window)
    return c


def _filed(delay=str(HOUR), window=str(DAY)):
    c = _bench(delay, window)
    gl.message.sender_address = REPORTER
    c.file_report(R, K, URL, CLAIM)
    return c


def _ruled(violation=True):
    c = _filed()
    advance(gl, HOUR)
    gl.llm_reply = json.dumps({"violation": violation})
    c.rule_on(R)
    return c


def _get(c):
    return json.loads(c.get_report(R))


def test_a_rule_is_published_once_with_its_own_process():
    c = _bench()
    rule = json.loads(c.get_rule(K))
    assert rule["author"] == AUTHOR and rule["text"] == RULE
    assert rule["review_delay"] == HOUR and rule["appeal_window"] == DAY
    assert len(rule["text_hash"]) == 64
    for caller in (AUTHOR, STRANGER):
        gl.message.sender_address = caller
        with pytest.raises(Exception, match="cannot be edited"):
            c.publish_rule(K, "No advertising", "Anything goes now.")
    assert json.loads(c.get_rule(K))["text"] == RULE


def test_filing_freezes_the_content_in_the_same_transaction():
    c = _filed()
    r = _get(c)
    assert r["status"] == "filed" and r["reporter"] == REPORTER
    assert r["rule_text"] == RULE and r["claim"] == CLAIM and r["content_url"] == URL
    assert len(r["content_hash"]) == 64 and r["total_chars"] == len(gl.page)
    assert r["excerpts"] and "spam-shop" in r["excerpts"][0]["text"]
    assert r["ruling_opens_at"] == r["filed_at"] + HOUR
    assert r["first_violation"] is None and r["final_violation"] is None
    assert json.loads(c.get_rule(K))["reports"] == 1
    assert gl.prompts == []  # filing judges nothing


def test_an_upheld_report_becomes_final_when_nobody_appeals():
    c = _ruled(True)
    r = _get(c)
    assert r["status"] == "ruled" and r["first_violation"] is True
    assert r["appeal_closes_at"] == r["ruled_at"] + DAY
    assert json.loads(c.get_ruling(R))["final"] is False
    assert json.loads(c.get_ruling(R))["violation"] is None  # not final: no verdict to act on

    advance(gl, DAY)
    gl.message.sender_address = STRANGER
    c.finalize(R)
    ruling = json.loads(c.get_ruling(R))
    assert ruling["final"] is True and ruling["violation"] is True
    assert ruling["overturned"] is False
    stats = json.loads(c.get_stats())
    assert stats["final"] == 1 and stats["upheld"] == 1 and stats["rulings"] == 1
    assert [e["kind"] for e in json.loads(c.get_events())] == [
        "RulePublished",
        "Filed",
        "Ruled",
        "Final",
    ]


def test_a_dismissed_report_becomes_final_too():
    c = _ruled(False)
    advance(gl, DAY)
    c.finalize(R)
    ruling = json.loads(c.get_ruling(R))
    assert ruling["final"] is True and ruling["violation"] is False
    assert json.loads(c.get_stats())["dismissed"] == 1


def test_an_appeal_gets_a_second_independent_ruling_that_is_final():
    c = _ruled(True)
    gl.message.sender_address = POSTER
    c.appeal(R, "I was quoting a spam message to warn others, not advertising it.")
    r = _get(c)
    assert r["status"] == "appealed" and len(r["grounds"]) == 1

    advance(gl, DAY)
    gl.llm_reply = '{"violation": false}'
    gl.message.sender_address = STRANGER
    c.rule_on_appeal(R)
    r = _get(c)
    assert r["status"] == "final" and r["first_violation"] is True
    assert r["appeal_violation"] is False and r["final_violation"] is False
    assert r["overturned"] is True and "overturned" in r["last_detail"]
    assert "APPEAL GROUNDS" in gl.prompts[-1] and "quoting a spam message" in gl.prompts[-1]
    stats = json.loads(c.get_stats())
    assert stats["overturned"] == 1 and stats["dismissed"] == 1 and stats["rulings"] == 2


def test_an_appeal_can_also_confirm_the_first_ruling():
    c = _ruled(True)
    gl.message.sender_address = POSTER
    c.appeal(R, "It was a joke.")
    advance(gl, DAY)
    c.rule_on_appeal(R)
    r = _get(c)
    assert r["final_violation"] is True and r["overturned"] is False


def test_the_reporter_may_withdraw_before_the_first_ruling_only():
    c = _filed()
    gl.message.sender_address = STRANGER
    with pytest.raises(Exception, match="only the reporter"):
        c.withdraw(R)
    gl.message.sender_address = REPORTER
    c.withdraw(R)
    assert _get(c)["status"] == "withdrawn"
    advance(gl, HOUR)
    with pytest.raises(Exception, match="not waiting for a first ruling"):
        c.rule_on(R)

    c = _ruled(True)
    gl.message.sender_address = REPORTER
    with pytest.raises(Exception, match="only before its first ruling"):
        c.withdraw(R)


def test_the_schedule_view_tells_an_app_which_step_is_accepted():
    c = _filed()
    s = json.loads(c.get_schedule(R))
    assert s["can_rule"] is False and s["can_appeal"] is False
    advance(gl, HOUR)
    assert json.loads(c.get_schedule(R))["can_rule"] is True
    c.rule_on(R)
    s = json.loads(c.get_schedule(R))
    assert s["can_appeal"] is True and s["can_finalize"] is False
    advance(gl, DAY)
    s = json.loads(c.get_schedule(R))
    assert s["can_appeal"] is False and s["can_finalize"] is True
    assert s["can_rule_on_appeal"] is False


def test_validation_rules():
    c = _bench()
    with pytest.raises(Exception, match="review_delay must be between"):
        c.publish_rule("a", "t", RULE, "5")
    with pytest.raises(Exception, match="appeal_window must be between"):
        c.publish_rule("b", "t", RULE, "60", "99999999")
    with pytest.raises(Exception, match="text is required"):
        c.publish_rule("c", "t", "   ")
    with pytest.raises(Exception, match="text exceeds"):
        c.publish_rule("d", "t", "x" * 601)
    with pytest.raises(Exception, match="unknown rule_id"):
        c.file_report("r", "nope", URL, CLAIM)
    with pytest.raises(Exception, match="https://"):
        c.file_report("r", K, "http://forum.example/t/1", CLAIM)
    with pytest.raises(Exception, match="path segments"):
        c.file_report("r", K, "https://forum.example/a/../b", CLAIM)
    with pytest.raises(Exception, match="claim is required"):
        c.file_report("r", K, URL, " ")
    c.file_report(R, K, URL, CLAIM)
    with pytest.raises(Exception, match="already exists"):
        c.file_report(R, K, URL, CLAIM)
    with pytest.raises(Exception, match="unknown report_id"):
        c.rule_on("missing")
    assert json.loads(c.get_report("missing"))["error"] == "unknown report_id"
    assert json.loads(c.list_rules()) == [K] and json.loads(c.list_reports()) == [R]
    assert c.get_admin() == ""
