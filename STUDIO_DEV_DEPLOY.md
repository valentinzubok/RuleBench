# RuleBench v1 — Studio Dev (chain 61997) deploy record

| | |
|---|---|
| **Network** | GenLayer Studio Dev / Studio Next — chain `61997`, GenVM `v0.3.0` |
| **Contract** | [`0xE61681930Fb59B22E2764d95fbd041282cb1CD0d`](https://explorer-studio-dev.genlayer.com/address/0xE61681930Fb59B22E2764d95fbd041282cb1CD0d) |
| **Source** | [`contracts/RuleBench.py`](contracts/RuleBench.py) — runner `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng` |
| **Source sha256** | `6bf7ed98cca98b74b67a45380efa7e6e4016b31239b935f53cc409b54cf00b78` |
| **Console** | https://valentinzubok.github.io/RuleBench/ · [RuleBench](https://github.com/valentinzubok/RuleBench) |
| **Deployer** | `0x4130dC892bD57009Ba795d746354072465b84412` — a separate test account; below it is refused a withdrawal and files the appeal |
| **Rule author and reporter in the demo** | `0xBA989D240AAB780d3d2eD2201f5F677098901408` (test account) |
| **Owner / admin** | none — the contract has no privileged address; `get_admin()` returns `""` |

## Verify that the deployed code equals this source

```bash
curl -s -X POST https://studio-dev.genlayer.com/api -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"gen_getContractCode","params":["0xE61681930Fb59B22E2764d95fbd041282cb1CD0d"]}' \
  | python3 -c "import sys,json,base64,hashlib; print(hashlib.sha256(base64.b64decode(json.load(sys.stdin)['result'])).hexdigest())"
shasum -a 256 contracts/RuleBench.py
# both print 6bf7ed98cca98b74b67a45380efa7e6e4016b31239b935f53cc409b54cf00b78
```

`scripts/verify_deployment.py` does the same check and runs in CI. The constructor takes no
arguments, so the deployed code is this file and nothing else.

## On-chain lifecycle: the same advert, twice

Two threads were reported under **one rule with one identical claim**:

- [`post-ad.html`](https://github.com/valentinzubok/RuleBench/blob/main/web/public/fixtures/post-ad.html)
  — a post advertising a paid follower service with discount code `HARBOR20` and a referral link.
- [`post-warning.html`](https://github.com/valentinzubok/RuleBench/blob/main/web/public/fixtures/post-warning.html)
  — a post that quotes that same advert, code included, to warn members not to use it.

A keyword filter sees the same words in both. The content URLs filed on chain are pinned to commit
`d0eebe5e7d028050f30cb1f3e2ed2b2d116f43fa`
(`https://raw.githubusercontent.com/valentinzubok/RuleBench/d0eebe5e…/web/public/fixtures/…`), so
the reported bytes are identified by the URL itself as well as by the SHA-256 stored at filing.

Rule `forum/no-ads`: *"No advertising of paid services, referral links or discount codes. Quoting
such a message in order to warn others about it is allowed."* — `review_delay = 120`,
`appeal_window = 180`.

| # | Caller | Step | Result | Tx |
|---|--------|------|--------|----|
| 0 | deployer | deploy | contract created | `0x24e92b42bfebef2c3bc4947004967123c7b29eab8ab2ad804a34ef5c50b08a14` |
| 1 | author | `publish_rule("forum/no-ads", …, review_delay=120, appeal_window=180)` | published at `1791231983`; text hash `a761a829…` | `0xb85e112035f141a6a9d15bbe0ad3093c3e280a466cf645430204c0f4cc9ff434` |
| 2 | reporter | `file_report("case-ad", "forum/no-ads", …/post-ad.html, claim)` | **frozen** at `1791231991`: sha256 `d8d4d214…`, 989 of 989 chars kept | `0xd722ce68454d00c010c8303bc01b8149eeeb4e616d49922f6aea7d7a90898d66` |
| 3 | reporter | `file_report("case-warning", "forum/no-ads", …/post-warning.html, same claim)` | **frozen** at `1791231999`: sha256 `2c25bdd3…`, 1226 of 1226 chars kept | `0xc0434382248d33ecb232e9bc627cc71dc8b21d4becb8a7cd57da04a819d0be9a` |
| 4 | reporter | `rule_on("case-ad")` immediately | **reverted** — `the review delay has not elapsed; a ruling is accepted at 1791232111` | `0x9c0ffade3fd02aff1e112b01771d33684d9a3f095523a6c96e0c98f1ad3744ce` (ERROR) |
| 5 | **deployer** | `withdraw("case-ad")` | **reverted** — `only the reporter may withdraw this report`. Deploying the contract does not let you make a case disappear. | `0x7d7433d8cf8b366e2a46c2aad5a3dcc87b4434a702c2a2b687d2e2302e5f267c` (ERROR) |
| 6 | reporter | `rule_on("case-ad")` at `1791232121` | **first ruling: violation** — 130 s after filing | `0x28c7df722d60caa871b360a736365b0327f31a5af63e7ac904a2e0cfc345384b` |
| 7 | reporter | `rule_on("case-warning")` at `1791232144` | **first ruling: no violation** — same words, same claim, opposite verdict | `0x49b51088dbddf2364f552763cb2ad441c996d90dc42f833115c1a5eae293312c` |
| 8 | reporter | `finalize("case-ad")` inside the appeal window | **reverted** — `the appeal window is still open; it can be finalized from 1791232301` | `0x5858ba82bb8a74fe2dd1042ce78ed882b68df0dc81accc23268e2d93c2fd781c` (ERROR) |
| 9 | deployer (as an appellant) | `appeal("case-warning", "The thread contains the full advert text and a working discount code. Whatever the intent, that is advertising a paid service.")` | grounds attached; the report is now appealed | `0xd466f2a3b4a21262e5364ef10e2a0cfb9dc24ff0857b1191c2e96f092000b639` |
| 10 | reporter | `rule_on_appeal("case-warning")` inside the window | **reverted** — `the appeal window is still open; the appeal is ruled on from 1791232324` | `0x5625393439b871a6028f597e117eea4d2759702e0ac814ab3e0689fe79f4a030` (ERROR) |
| 11 | reporter | `finalize("case-ad")` at `1791232306` | **final: violation** — nobody appealed within the window | `0x235ca8b0bb7551514388fee06f6e7f5631dd0222abcbb4d8b3e896bad49c1047` |
| 12 | reporter | `rule_on_appeal("case-warning")` at `1791232328` | **final on appeal: no violation** — a second, independent round with the grounds in view confirmed the first ruling | `0x88c390752e8e0aa61aa6c994c46fa3aef369e182bbb7db462ed90ba8c0c6d236` |

State (`get_stats`):
`{"rules":1,"reports":2,"filed":0,"ruled":0,"appealed":0,"final":2,"withdrawn":0,"upheld":1,"dismissed":1,"overturned":0,"rulings":3}`

- `get_ruling("case-ad")` → `final: true, violation: true`
- `get_ruling("case-warning")` → `final: true, violation: false, overturned: false`

Twelve calls after the deploy, three consensus rulings, and four refusals made by the contract
itself: an early ruling, a withdrawal by the wrong account, an early finalization and an early
appeal ruling. The delays are minutes here so the flow can be reproduced quickly; a real community
would use hours or days (both accept 60 s – 30 days).

### Two things this run does not show

- An appeal that **overturns** a first ruling. The path is covered by
  `tests/test_lifecycle.py::test_an_appeal_gets_a_second_independent_ruling_that_is_final`; on
  chain both rounds agreed, which is the honest outcome for this evidence.
- The step-10 transaction hit an RPC hiccup on the client side while it was being awaited, so its
  hash was recovered afterwards from `sim_getTransactionsForAddress` and its revert reason read
  from the receipt. It is listed above with the real hash and reason.

## Design notes for reviewers

| Concern | Where it is handled |
|---|---|
| Evidence fixed at filing, never chosen at ruling time | `file_report` freezes hash and excerpt; `rule_on(report_id)` and `rule_on_appeal(report_id)` take one parameter and do not fetch. `test_deleting_or_rewriting_the_post_after_filing_changes_nothing`. |
| Time limits are elapsed transaction time, not calendar windows | `ruling_opens_at = filed_at + review_delay`, `appeal_closes_at = ruled_at + appeal_window`, both stored per report. `test_the_delay_is_elapsed_time_not_a_calendar_boundary`. |
| The process cannot be chosen by an interested party | The delays belong to the rule; `file_report` has no time parameters. `test_the_reporter_cannot_choose_or_shorten_the_process`. |
| No privileged override of user-held state | No owner storage, constructor argument or ownership transfer; no `overrule`/`dismiss`/`reopen`. `test_the_contract_exposes_no_owner_admin_override_or_reopen`, `test_the_rule_author_and_the_deployer_have_no_power_over_a_report`. |
| Model output validated as a literal JSON boolean | `literal_bool`; fifteen malformed replies for the first ruling and six for the appeal. |
| Fail closed | No `strict_eq` fallback for a verdict; `principle` passed positionally; `test_a_consensus_failure_reverts_in_both_rounds`. The rulings counter is written only after a verdict exists. |
| Untrusted data | Rule, claim, excerpts and appeal grounds are fenced, inner fences scrubbed, injection phrasing flagged and stored. |
| Bounded, deterministic evidence that leaves no gap in a short post | SHA-256 over the whole normalized document; documents up to 2400 chars are frozen whole; longer ones keep the head, keyword windows and then uncovered stretches. `test_a_document_that_fits_the_budget_is_frozen_whole`. |

The gap-free excerpt came out of this very run: a first deployment kept only two 400-character
windows of a 1 226-character page and missed the quoted advert between them. The digest was fixed,
three tests were added, and the contract was redeployed at the address above before any of the
transactions listed here.
