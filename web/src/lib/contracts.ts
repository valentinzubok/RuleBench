import { CONTRACT_ADDRESS } from "./config";
import { type Address, type TxStage, parseJson, readContract, writeAndWait } from "./genlayer";

export type RuleRow = {
  rule_id: string;
  author: string;
  title: string;
  text: string;
  text_hash: string;
  review_delay: number;
  appeal_window: number;
  published_at: number;
  reports: number;
};

export type Excerpt = { from_char: number; match: string; text: string };
export type Grounds = { by: string; text: string; at: number };

export type ReportRow = {
  report_id: string;
  rule_id: string;
  rule_title: string;
  rule_text: string;
  rule_text_hash: string;
  review_delay: number;
  appeal_window: number;
  reporter: string;
  content_url: string;
  claim: string;
  content_hash: string;
  total_chars: number;
  excerpt_chars: number;
  covers_whole_document: boolean;
  excerpts: Excerpt[];
  filed_at: number;
  ruling_opens_at: number;
  status: string;
  first_violation: boolean | null;
  ruled_at: number;
  appeal_closes_at: number;
  grounds: Grounds[];
  appeal_violation: boolean | null;
  appeal_ruled_at: number;
  final_violation: boolean | null;
  final_at: number;
  overturned: boolean;
  injection_flags: string[];
  last_detail: string;
};

export type Schedule = {
  report_id: string;
  now: number;
  status: string;
  ruling_opens_at: number;
  can_rule: boolean;
  appeal_closes_at: number;
  can_appeal: boolean;
  can_rule_on_appeal: boolean;
  can_finalize: boolean;
  grounds: number;
};

export type EventRow = { kind: string; [key: string]: unknown };

export type Stats = {
  rules: number;
  reports: number;
  filed: number;
  ruled: number;
  appealed: number;
  final: number;
  withdrawn: number;
  upheld: number;
  dismissed: number;
  overturned: number;
  rulings: number;
};

type OnStage = (stage: TxStage, hash: string) => void;

const read = <T,>(fn: string, args: string[], fallback: T) =>
  readContract<string>(CONTRACT_ADDRESS, fn, args).then((raw) => parseJson<T>(raw, fallback));

export const listRules = () => read<string[]>("list_rules", [], []);
export const listReports = () => read<string[]>("list_reports", [], []);
export const getEvents = () => read<EventRow[]>("get_events", [], []);
export const getStats = () => read<Stats | null>("get_stats", [], null);

export async function getRule(id: string): Promise<RuleRow | null> {
  const parsed = await read<RuleRow & { error?: string }>("get_rule", [id], {} as RuleRow);
  return parsed.rule_id ? parsed : null;
}

export async function getReport(id: string): Promise<ReportRow | null> {
  const parsed = await read<ReportRow & { error?: string }>("get_report", [id], {} as ReportRow);
  return parsed.report_id ? parsed : null;
}

/** Which step is accepted right now — read it before paying a fee for a call that reverts. */
export async function getSchedule(id: string): Promise<Schedule | null> {
  const parsed = await read<Schedule & { error?: string }>("get_schedule", [id], {} as Schedule);
  return parsed.report_id ? parsed : null;
}

const write = (
  account: Address,
  provider: unknown,
  fn: string,
  args: string[],
  onStage?: OnStage,
) => writeAndWait(account, provider, CONTRACT_ADDRESS, fn, args, onStage);

export const publishRule = (
  account: Address,
  provider: unknown,
  ruleId: string,
  title: string,
  text: string,
  reviewDelay: string,
  appealWindow: string,
  onStage?: OnStage,
) =>
  write(account, provider, "publish_rule", [ruleId, title, text, reviewDelay, appealWindow], onStage);

export const fileReport = (
  account: Address,
  provider: unknown,
  reportId: string,
  ruleId: string,
  contentUrl: string,
  claim: string,
  onStage?: OnStage,
) => write(account, provider, "file_report", [reportId, ruleId, contentUrl, claim], onStage);

export const ruleOn = (account: Address, provider: unknown, id: string, onStage?: OnStage) =>
  write(account, provider, "rule_on", [id], onStage);

export const appeal = (
  account: Address,
  provider: unknown,
  id: string,
  grounds: string,
  onStage?: OnStage,
) => write(account, provider, "appeal", [id, grounds], onStage);

export const ruleOnAppeal = (account: Address, provider: unknown, id: string, onStage?: OnStage) =>
  write(account, provider, "rule_on_appeal", [id], onStage);

export const finalize = (account: Address, provider: unknown, id: string, onStage?: OnStage) =>
  write(account, provider, "finalize", [id], onStage);

export const withdraw = (account: Address, provider: unknown, id: string, onStage?: OnStage) =>
  write(account, provider, "withdraw", [id], onStage);
