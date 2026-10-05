/** Live RuleBench deploy on GenLayer Studio Dev (chain 61997). Override via env. */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_RULEBENCH_ADDRESS ||
  "0xBf9Fd0991CEe7f2133E14351fd41cAbFBeD05BA9") as `0x${string}`;

/** Studio Dev / Studio Next — chain ID 61997. */
export const CHAIN_ID = 61997;
export const RPC_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio-dev.genlayer.com/api";
export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_GENLAYER_EXPLORER || "https://explorer-studio-dev.genlayer.com";
export const EXPLORER = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;
export const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;

export const GITHUB = "https://github.com/valentinzubok/RuleBench";
export const CONTRACT_REPO = "https://github.com/valentinzubok/RuleBenchCore";

/** The demo content pages live in this repository, so every change is a public commit. */
export const DEMO_AD = "https://valentinzubok.github.io/RuleBench/fixtures/post-ad.html";
export const DEMO_WARNING = "https://valentinzubok.github.io/RuleBench/fixtures/post-warning.html";
export const DEMO_RULE_ID = "forum/no-ads";
export const DEMO_RULE_TITLE = "No advertising";
export const DEMO_RULE_TEXT =
  "No advertising of paid services, referral links or discount codes. Quoting such a message in order to warn others about it is allowed.";
export const DEMO_CLAIM =
  "A post in this thread advertises a paid follower service with a discount code.";
