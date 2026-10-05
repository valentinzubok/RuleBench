"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHAIN_ID,
  CONTRACT_ADDRESS,
  CONTRACT_REPO,
  DEMO_AD,
  DEMO_CLAIM,
  DEMO_RULE_ID,
  DEMO_RULE_TEXT,
  DEMO_RULE_TITLE,
  DEMO_WARNING,
  EXPLORER,
  GITHUB,
  txUrl,
} from "@/lib/config";
import {
  appeal,
  fileReport,
  finalize,
  getEvents,
  getReport,
  getRule,
  getSchedule,
  getStats,
  listReports,
  listRules,
  publishRule,
  ruleOn,
  ruleOnAppeal,
  withdraw,
  type EventRow,
  type ReportRow,
  type RuleRow,
  type Schedule,
  type Stats,
} from "@/lib/contracts";
import { fundWithTestGen, getNativeBalance, type TxStage } from "@/lib/genlayer";
import { useWallet } from "./WalletProvider";

const short = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : "—");
const shortHash = (h: string) => (h ? `${h.slice(0, 16)}…` : "—");
const utc = (seconds: number) =>
  seconds ? `${new Date(seconds * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC` : "—";
const span = (seconds: number) =>
  seconds >= 86400
    ? `${Math.round(seconds / 8640) / 10} d`
    : seconds >= 3600
      ? `${Math.round(seconds / 360) / 10} h`
      : `${Math.round(seconds / 6) / 10} min`;
const verdict = (v: boolean | null) =>
  v === true ? "violation" : v === false ? "no violation" : "—";

/** Hero illustration: the four things a ruling goes through, none of them a person. */
function Bench() {
  const steps = [
    ["Rule", "published once, with its own delays; never edited"],
    ["Report", "content frozen on chain in the filing transaction"],
    ["Ruling", "after the review delay: one boolean by consensus"],
    ["Appeal", "after the window closes: a second, final round"],
  ];
  return (
    <div className="benchbox" aria-hidden="true">
      {steps.map(([name, text], i) => (
        <div className="step" key={name}>
          <span className="n">{i + 1}</span>
          <div>
            <b>{name}</b>
            <span>{text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Stages({ r }: { r: ReportRow }) {
  const order = ["filed", "ruled", "appealed", "final"];
  const at = r.status === "withdrawn" ? -1 : order.indexOf(r.status);
  const appealed = r.grounds.length > 0;
  return (
    <div className="stages">
      {order
        .filter((s) => s !== "appealed" || appealed || r.status !== "final")
        .map((s) => {
          const i = order.indexOf(s);
          return (
            <span key={s} className={i < at ? "done" : i === at ? "now" : ""}>
              {s === "filed" ? "frozen & filed" : s === "ruled" ? "first ruling" : s}
            </span>
          );
        })}
      {r.status === "withdrawn" && <span className="now">withdrawn</span>}
    </div>
  );
}

export function RuleBenchApp() {
  const { address, provider, connect, error: walletError } = useWallet();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [events, setEvents] = useState<EventRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [gen, setGen] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [tx, setTx] = useState("");
  const [stage, setStage] = useState<TxStage | "">("");

  const [ruleId, setRuleId] = useState("forum/my-rule");
  const [ruleTitle, setRuleTitle] = useState(DEMO_RULE_TITLE);
  const [ruleText, setRuleText] = useState(DEMO_RULE_TEXT);
  const [reviewDelay, setReviewDelay] = useState("120");
  const [appealWindow, setAppealWindow] = useState("180");

  const [reportId, setReportId] = useState("case-my-1");
  const [reportRule, setReportRule] = useState(DEMO_RULE_ID);
  const [contentUrl, setContentUrl] = useState(DEMO_AD);
  const [claim, setClaim] = useState(DEMO_CLAIM);
  const [grounds, setGrounds] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleIds, reportIds, s, ev] = await Promise.all([
        listRules(),
        listReports(),
        getStats(),
        getEvents(),
      ]);
      setStats(s);
      setEvents(ev.slice(-10).reverse());
      const loadedRules = await Promise.all(ruleIds.map((id) => getRule(id)));
      setRules(loadedRules.filter(Boolean) as RuleRow[]);
      const loadedReports = await Promise.all(reportIds.map((id) => getReport(id)));
      setReports((loadedReports.filter(Boolean) as ReportRow[]).reverse());
      const sched = await Promise.all(reportIds.map((id) => getSchedule(id)));
      setSchedules(
        Object.fromEntries(
          sched.filter(Boolean).map((x) => [(x as Schedule).report_id, x as Schedule]),
        ),
      );
      if (address) setGen(await getNativeBalance(address));
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "read failed"}`);
      setOk(false);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** ACCEPTED and FINALIZED are different guarantees, so the UI shows both. */
  const onStage = (next: TxStage, hash: string) => {
    setTx(hash);
    setStage(next);
    if (next === "finalized") void refresh();
  };

  const run = async (name: string, fn: () => Promise<string | void>) => {
    if (!address || !provider) {
      setMsg("Connect MetaMask for writes");
      setOk(false);
      return;
    }
    setBusy(name);
    setMsg("");
    setStage("");
    try {
      const hash = await fn();
      if (hash) setTx(hash);
      await refresh();
      setMsg(`${name}: accepted by consensus`);
      setOk(true);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
      setOk(false);
    } finally {
      setBusy("");
    }
  };

  const acct = address as `0x${string}`;
  const disabled = !!busy || !address;

  return (
    <main className="wrap">
      <section className="hero">
        <div>
          <h1>
            Rule<span className="accent">Bench</span>
          </h1>
          <p className="lede">
            A moderation ruling with no moderator. A rule is published once. A report{" "}
            <strong>freezes the content on chain the moment it is filed</strong>, so deleting or
            editing the post changes nothing. After the rule&apos;s own delay, GenLayer validators
            agree on one thing — does this content clearly break this rule? — and an appeal gets
            a second, independent round.
          </p>
          <div className="chips">
            <span className="chip">
              chain <b>{CHAIN_ID}</b>
            </span>
            {stats && (
              <>
                <span className="chip">
                  rules <b>{stats.rules}</b>
                </span>
                <span className="chip">
                  reports <b>{stats.reports}</b>
                </span>
                <span className="chip hot">
                  upheld <b>{stats.upheld}</b>
                </span>
                <span className="chip">
                  dismissed <b>{stats.dismissed}</b>
                </span>
                <span className="chip">
                  overturned on appeal <b>{stats.overturned}</b>
                </span>
              </>
            )}
          </div>
          <p className="muted" style={{ marginTop: "0.8rem" }}>
            Contract <a href={EXPLORER}>{short(CONTRACT_ADDRESS, 12)}</a> · no owner, no admin ·{" "}
            <a href={CONTRACT_REPO}>contract source</a> · <a href={GITHUB}>this console</a>
          </p>
          <div>
            {!address ? (
              <button onClick={() => void connect()}>Connect MetaMask</button>
            ) : (
              <span className="pill">
                <span className="dot" /> {short(address)} · {gen || "?"} GEN
              </span>
            )}
            {address && (
              <button
                className="ghost"
                style={{ marginLeft: "0.5rem" }}
                disabled={!!busy}
                onClick={() =>
                  void run("Get test GEN", async () => {
                    await fundWithTestGen(acct);
                  })
                }
              >
                Get test GEN
              </button>
            )}
          </div>
          {walletError && <p className="msg">{walletError}</p>}
          {msg && <p className={ok ? "okmsg" : "msg"}>{msg}</p>}
          {tx && (
            <p className="tx muted">
              last tx <a href={txUrl(tx)}>{short(tx, 14)}</a>{" "}
              {stage === "finalized" ? (
                <span className="stagepill final">finalized</span>
              ) : (
                <span className="stagepill accepted">accepted — awaiting finalization</span>
              )}
            </p>
          )}
        </div>
        <Bench />
      </section>

      <div className="row">
        <section className="card">
          <h2>1 · Publish a rule</h2>
          <p className="muted">
            The text and the two delays are fixed for good: a rule id can never be published
            twice, by you or anyone. The delays belong to the rule, so a reporter cannot shorten
            them, and the contract has no owner who could.
          </p>
          <label htmlFor="ruleId">Rule id</label>
          <input id="ruleId" value={ruleId} onChange={(e) => setRuleId(e.target.value)} />
          <label htmlFor="ruleTitle">Title</label>
          <input id="ruleTitle" value={ruleTitle} onChange={(e) => setRuleTitle(e.target.value)} />
          <label htmlFor="ruleText">Rule text</label>
          <textarea
            id="ruleText"
            rows={3}
            value={ruleText}
            onChange={(e) => setRuleText(e.target.value)}
          />
          <div className="grid2">
            <div>
              <label htmlFor="reviewDelay">Review delay (s)</label>
              <input
                id="reviewDelay"
                value={reviewDelay}
                onChange={(e) => setReviewDelay(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="appealWindow">Appeal window (s)</label>
              <input
                id="appealWindow"
                value={appealWindow}
                onChange={(e) => setAppealWindow(e.target.value)}
              />
            </div>
          </div>
          <p className="muted">
            A report under this rule cannot be final sooner than{" "}
            {span((Number(reviewDelay) || 0) + (Number(appealWindow) || 0))} after filing. Demo
            values are minutes; a real community would use hours or days.
          </p>
          <button
            disabled={disabled || !ruleId || !ruleTitle || !ruleText}
            onClick={() =>
              void run("publish_rule", () =>
                publishRule(
                  acct,
                  provider,
                  ruleId,
                  ruleTitle,
                  ruleText,
                  reviewDelay,
                  appealWindow,
                  onStage,
                ),
              )
            }
          >
            {busy === "publish_rule" ? (
              <span className="working">
                <span className="spinner" /> publishing…
              </span>
            ) : (
              "publish the rule"
            )}
          </button>

          {rules.length > 0 && (
            <>
              <h2 style={{ marginTop: "1.4rem" }}>Published rules</h2>
              {rules.map((k) => (
                <p className="hashline" key={k.rule_id}>
                  <code>{k.rule_id}</code> — {k.text}{" "}
                  <span className="muted">
                    (review {span(k.review_delay)}, appeal {span(k.appeal_window)}, {k.reports}{" "}
                    report(s), sha-256 {shortHash(k.text_hash)})
                  </span>
                </p>
              ))}
            </>
          )}
        </section>

        <section className="card">
          <h2>2 · File a report</h2>
          <p className="muted">
            Filing fetches the page under consensus and stores its SHA-256 and a bounded excerpt
            with the report. From then on the case does not depend on the page. Content nobody
            can read cannot be reported.
          </p>
          <label htmlFor="reportId">Report id</label>
          <input id="reportId" value={reportId} onChange={(e) => setReportId(e.target.value)} />
          <label htmlFor="reportRule">Rule id</label>
          <input
            id="reportRule"
            value={reportRule}
            onChange={(e) => setReportRule(e.target.value)}
          />
          <label htmlFor="contentUrl">Content page (https)</label>
          <input
            id="contentUrl"
            value={contentUrl}
            onChange={(e) => setContentUrl(e.target.value)}
          />
          <p className="muted">
            Demo pages:{" "}
            <button className="ghost tiny" onClick={() => setContentUrl(DEMO_AD)}>
              an advert
            </button>
            <button className="ghost tiny" onClick={() => setContentUrl(DEMO_WARNING)}>
              a warning quoting the same advert
            </button>
          </p>
          <label htmlFor="claim">What is the violation?</label>
          <textarea id="claim" rows={2} value={claim} onChange={(e) => setClaim(e.target.value)} />
          <button
            disabled={disabled || !reportId || !reportRule || !claim}
            onClick={() =>
              void run("file_report", () =>
                fileReport(acct, provider, reportId, reportRule, contentUrl, claim, onStage),
              )
            }
          >
            {busy === "file_report" ? (
              <span className="working">
                <span className="spinner" /> freezing…
              </span>
            ) : (
              "freeze the content and file"
            )}
          </button>
          <p className="muted" style={{ marginTop: "1rem" }}>
            A sanction is the consequential outcome, so doubt resolves to{" "}
            <strong>no violation</strong>, the reporter&apos;s claim is treated as an allegation
            rather than evidence, and a malformed model answer, a model error or a consensus
            failure <strong>reverts the transaction</strong> — no ruling is recorded.
          </p>
        </section>
      </div>

      <section style={{ marginTop: "2rem" }}>
        <h2>Reports on chain {loading && <span className="spinner" />}</h2>
        {reports.length === 0 && !loading && <p className="muted">No reports yet.</p>}
        {reports.map((r) => {
          const s = schedules[r.report_id];
          const final = r.status === "final";
          const shown = final ? r.final_violation : r.first_violation;
          const tone = shown === true ? "broken" : shown === false ? "ok" : "neutral";
          return (
            <article key={r.report_id} className={`card claim ${tone}`}>
              <div className="head">
                <span className="id">{r.report_id}</span>
                <span className={`verdict ${tone}`}>
                  {r.status === "withdrawn"
                    ? "withdrawn"
                    : shown === null
                      ? "waiting for the review delay"
                      : `${verdict(shown)}${final ? " · final" : " · not final"}`}
                </span>
                <span className="muted">
                  rule <code>{r.rule_id}</code>
                </span>
              </div>
              <Stages r={r} />
              <p className="claimtext">“{r.claim}”</p>
              <p className="hashline">rule as filed: {r.rule_text}</p>
              <p className="hashline">
                content <a href={r.content_url}>{r.content_url}</a> · frozen sha-256{" "}
                <code>{shortHash(r.content_hash)}</code> · {r.excerpt_chars} of {r.total_chars}{" "}
                chars kept on chain
              </p>
              <div className="excerpt">
                {r.excerpts.map((e) => (
                  <p key={e.from_char}>{e.text}</p>
                ))}
              </div>
              {r.first_violation !== null && (
                <p className="hashline">
                  first ruling: <strong>{verdict(r.first_violation)}</strong> at {utc(r.ruled_at)}
                  {r.appeal_ruled_at > 0 && (
                    <>
                      {" "}
                      · appeal ruling: <strong>{verdict(r.appeal_violation)}</strong> at{" "}
                      {utc(r.appeal_ruled_at)}
                    </>
                  )}
                </p>
              )}
              {r.grounds.length > 0 && (
                <ul className="grounds">
                  {r.grounds.map((g) => (
                    <li key={g.by}>
                      <code>{short(g.by)}</code> appealed: “{g.text}”
                    </li>
                  ))}
                </ul>
              )}
              {final && (
                <p className="verdictbox">
                  <strong>final: {verdict(r.final_violation)}.</strong>{" "}
                  {r.overturned
                    ? "The appeal round overturned the first ruling."
                    : r.grounds.length > 0
                      ? "The appeal round confirmed the first ruling."
                      : "Nobody appealed within the window."}
                </p>
              )}
              {s && !final && r.status !== "withdrawn" && (
                <p className="hashline">
                  {r.status === "filed"
                    ? s.can_rule
                      ? "the review delay has elapsed: a ruling is accepted now"
                      : `a ruling is accepted from ${utc(s.ruling_opens_at)}`
                    : s.can_rule_on_appeal
                      ? "the appeal window has closed: the appeal can be ruled on now"
                      : s.can_finalize
                        ? "the appeal window has closed: this ruling can be made final"
                        : `appeal window open until ${utc(s.appeal_closes_at)}`}
                </p>
              )}
              {r.injection_flags?.length > 0 && (
                <p className="hashline flagged">
                  injection phrasing seen in the data: {r.injection_flags.join(", ")}
                </p>
              )}
              {r.status === "filed" && (
                <button
                  className="ghost"
                  disabled={disabled || !s?.can_rule}
                  onClick={() =>
                    void run("rule_on", () => ruleOn(acct, provider, r.report_id, onStage))
                  }
                >
                  {s?.can_rule ? "ask for the first ruling" : "review delay not elapsed"}
                </button>
              )}
              {r.status === "filed" &&
                address &&
                address.toLowerCase() === r.reporter.toLowerCase() && (
                  <button
                    className="ghost"
                    style={{ marginLeft: "0.5rem" }}
                    disabled={disabled}
                    onClick={() =>
                      void run("withdraw", () => withdraw(acct, provider, r.report_id, onStage))
                    }
                  >
                    withdraw my report
                  </button>
                )}
              {s?.can_appeal && (
                <div>
                  <label htmlFor={`g-${r.report_id}`}>Appeal grounds</label>
                  <textarea
                    id={`g-${r.report_id}`}
                    rows={2}
                    value={grounds[r.report_id] || ""}
                    onChange={(e) => setGrounds({ ...grounds, [r.report_id]: e.target.value })}
                    placeholder="Why should the second round read this differently?"
                  />
                  <button
                    className="ghost"
                    disabled={disabled || !(grounds[r.report_id] || "").trim()}
                    onClick={() =>
                      void run("appeal", () =>
                        appeal(acct, provider, r.report_id, grounds[r.report_id], onStage),
                      )
                    }
                  >
                    attach appeal grounds
                  </button>
                </div>
              )}
              {r.status === "appealed" && (
                <button
                  className="ghost"
                  disabled={disabled || !s?.can_rule_on_appeal}
                  onClick={() =>
                    void run("rule_on_appeal", () =>
                      ruleOnAppeal(acct, provider, r.report_id, onStage),
                    )
                  }
                >
                  {s?.can_rule_on_appeal ? "rule on the appeal" : "appeal window still open"}
                </button>
              )}
              {r.status === "ruled" && (
                <button
                  className="ghost"
                  style={{ marginLeft: s?.can_appeal ? "0.5rem" : 0 }}
                  disabled={disabled || !s?.can_finalize}
                  onClick={() =>
                    void run("finalize", () => finalize(acct, provider, r.report_id, onStage))
                  }
                >
                  {s?.can_finalize ? "make it final" : "not final while it can be appealed"}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Recent events</h2>
        {events.length === 0 ? (
          <p className="muted">No events yet.</p>
        ) : (
          <ul className="timeline">
            {events.map((e, i) => (
              <li key={i} className={e.violation === true ? "broken" : ""}>
                <strong>{String(e.kind)}</strong>{" "}
                <span className="muted">
                  {[
                    e.id,
                    typeof e.violation === "boolean" ? verdict(e.violation) : null,
                    e.on_appeal ? "on appeal" : null,
                    e.overturned ? "overturned" : null,
                    typeof e.at === "number" ? utc(e.at) : null,
                  ]
                    .filter(Boolean)
                    .map(String)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="foot">
        RuleBench on GenLayer Studio Dev (chain {CHAIN_ID}). Reads work without a wallet; writes
        need MetaMask and test GEN for fees. The demo content pages are files in this repository,
        so every change to them is a public commit. Contract source:{" "}
        <a href={CONTRACT_REPO}>RuleBenchCore</a>.
      </footer>
    </main>
  );
}
