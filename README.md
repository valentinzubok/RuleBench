# RuleBench

<p align="center">
  <img src="assets/logo.png" alt="RuleBench" width="120" />
</p>

<p align="center">
  <strong>A moderation ruling with no moderator.</strong>
</p>

<p align="center">
  <a href="https://valentinzubok.github.io/RuleBench/"><img src="https://img.shields.io/badge/Live-Console-fb923c?style=flat-square" alt="Live console" /></a>
  <a href="https://github.com/valentinzubok/RuleBench/actions/workflows/ci.yml"><img src="https://github.com/valentinzubok/RuleBench/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/GenLayer-Studio%20Dev%2061997-fb923c?style=flat-square" alt="Studio Dev" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT" /></a>
</p>

---

## The trust problem

Every community has rules and someone who decides when they were broken. That person can be
biased, pressured or absent; the rule can be reworded after the fact; and the post in question can
be edited or deleted before a second pair of eyes sees it. A keyword filter is not an answer
either: it cannot tell an advert from a warning that quotes the advert.

**RuleBench makes "does this content clearly break this rule?" a consensus question about
evidence that can no longer change.**

```
publish_rule(rule_id, title, text, review_delay, appeal_window)
      once. The text and both delays are immutable, and the delays belong to the rule,
      so a reporter cannot shorten the process.

file_report(report_id, rule_id, content_url, claim)
      validators fetch the page under eq_principle.strict_eq IN THIS TRANSACTION; the contract
      stores its SHA-256, a bounded excerpt and a copy of the rule text with the report.
      From here on the case does not depend on the page. Unreadable content cannot be reported.

rule_on(report_id)                   anyone, once review_delay has elapsed since filing
      takes a report id and nothing else; judges the FROZEN excerpt, never the live page
      validators agree on one boolean: does the content clearly violate the rule?

appeal(report_id, grounds)           while the appeal window is open: any address, once each,
                                     up to three - nobody can use up the only slot

rule_on_appeal(report_id)            anyone, once the appeal window has CLOSED
      a second, independent consensus round over the same frozen evidence with the grounds
      in view. Its verdict is final.

finalize(report_id)                  anyone, once the window has closed with no appeal
withdraw(report_id)                  the reporter only, and only before the first ruling
get_ruling(report_id)                what a consumer reads: {final, violation, overturned, …}
```

### Why it fails the way it does

An upheld report is a sanction on a person, so doubt resolves to **no violation**, and a malformed
model answer, a model error or a consensus failure **reverts the transaction**: no ruling is
recorded in either direction.

| Risk | What stops it |
|---|---|
| The post is deleted or rewritten before anyone rules | The content is frozen in the filing transaction: SHA-256 of the whole document plus a bounded excerpt stored on chain. `rule_on` and `rule_on_appeal` never fetch the page again. |
| The rule is reworded to fit the case | A `rule_id` can be published once, by anyone, and has no edit function. The report also carries its own copy of the rule text and its hash. |
| Filing and ruling in one breath | `rule_on` reverts until `review_delay` seconds of transaction time have elapsed since filing. The delay is the rule's, not the reporter's: `file_report` has no time parameters. |
| A ruling made final before anyone could appeal | `finalize` reverts until the appeal window has closed. `get_ruling` reports `violation: null` until the report is final, so a consumer cannot act on a first ruling. |
| An appeal decided before the other side has spoken | `rule_on_appeal` reverts until the window has closed, so every side had the whole window to attach grounds. |
| Someone burning the appeal with empty grounds | Up to three addresses may attach grounds, one each. A stranger's placeholder does not stop the person concerned, or the reporter, from being heard. |
| A keyword match treated as a violation | The prompt separates content that breaks the rule from content that quotes, reports or warns about it, treats the reporter's claim as an allegation rather than evidence and appeal grounds as arguments rather than evidence, and resolves ambiguity to `false`. |
| `"true"`, `1` or `"yes"` counted as a verdict | `literal_bool()` accepts only JSON `true`/`false`; anything else reverts and no ruling is recorded. |
| An administrator overruling, dismissing or deleting a case | There is none: no owner, no admin, no ownership transfer, no `overrule`, no `reopen`. The rule's author has no power over reports under it. Only the reporter can withdraw, and only before the first ruling. |
| The content, the claim or the grounds steering the model | All four inputs are fenced as untrusted data, inner fences are neutralized, and injection phrasing is flagged to the model and stored on the report. |
| Part of the content never being read | The whole document is hashed. A document of up to 2400 chars is frozen whole. A longer one keeps the head, windows around every occurrence of the rule's and the claim's own words, and then the first stretches no window has covered, up to 2400 chars. |
| Consensus quietly degrading | No fallback: if `prompt_comparative` cannot run, the transaction reverts. `principle` is passed positionally (it is positional-only in GenVM v0.3). |

## Live

| | |
|---|---|
| Console | **https://valentinzubok.github.io/RuleBench/** (reads work with no wallet) |
| Network | GenLayer Studio Dev / Studio Next — chain `61997` |
| Contract | [`0xE61681930Fb59B22E2764d95fbd041282cb1CD0d`](https://explorer-studio-dev.genlayer.com/address/0xE61681930Fb59B22E2764d95fbd041282cb1CD0d) |
| Contract-only repo | [RuleBenchCore](https://github.com/valentinzubok/RuleBenchCore) |
| Deploy record | [`STUDIO_DEV_DEPLOY.md`](STUDIO_DEV_DEPLOY.md) — every transaction of the demo, including the refused ones |

`scripts/verify_deployment.py` runs in CI and fails the build if the deployed bytes stop matching
[`contracts/RuleBench.py`](contracts/RuleBench.py).

## The content pages are files in this repository

- [`web/public/fixtures/post-ad.html`](web/public/fixtures/post-ad.html) — a forum thread in
  which one post advertises a paid follower service with a discount code and a referral link.
- [`web/public/fixtures/post-warning.html`](web/public/fixtures/post-warning.html) — a thread
  that contains **the same advert text and the same discount code**, quoted inside a warning
  telling members not to use it.

Both were reported on chain under the same rule with the same claim. The deploy record shows what
the validators made of each.

## The console

[`web/`](web/) — Next.js 16 + `genlayer-js` 2.0.0-rc.1 + MetaMask, exported statically to Pages.
It reads rules, reports, frozen excerpts, schedules and events from chain without a wallet, writes
every contract function through MetaMask with Studio Dev fees, disables a button whose call would
revert (`get_schedule` is a free view), and distinguishes `ACCEPTED` from `FINALIZED` rather than
presenting acceptance as completion.

```bash
cd web
npm install
npm run dev      # http://localhost:3017
```

## Tests

```bash
pip install -r requirements-dev.txt
python3 -m pytest -q      # 57 tests
```

`tests/test_adversarial.py` is the half that matters:

- **Nothing malformed becomes a ruling.** Fifteen malformed answers to the first ruling and six
  to the appeal each revert and leave the report exactly as it was; so do a model error and a
  consensus failure in either round.
- **The evidence is what was frozen.** The post is deleted, then rewritten: both rulings still
  judge the frozen text. Unreadable content cannot be reported. The rule text is copied into the
  report and cannot change under it. A document that fits the budget is frozen whole, a keyword
  inside a kept window does not hide a later occurrence, and a violation 7 KB into a long thread is
  still in the excerpt.
- **The process cannot be hurried.** Four accounts cannot rule before the review delay; the
  reporter cannot pass a shorter delay; the delay is elapsed time, not a clock boundary; a ruling
  cannot be finalized while it can be appealed; an appeal is not ruled on until the window closes,
  and the other side's grounds, attached late in the window, are in the prompt.
- **Nobody can use up, bury or override a case.** One address cannot exhaust the appeal; the rule
  author and the deployer cannot withdraw a report; after a ruling not even the reporter can; a
  final ruling cannot be ruled on, appealed or finalized again; there is no owner or override.
- Injection in the content, the claim and the appeal grounds; digest bounds and determinism.

## License

[MIT](LICENSE) © 2026 Valentyn Zubok
