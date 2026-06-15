import { Filter } from "bad-words";

export type PrefilterResult =
  | { verdict: "spam"; reason: string }
  | { verdict: "pass" };

// ── Custom spam / danger rules ────────────────────────────────────────────────
// Each entry: [label, regex]. First match wins → immediate spam verdict.
// Patterns are case-insensitive and tested against the full lowercased content.

const SPAM_RULES: [string, RegExp][] = [
  // Crypto solicitation
  ["crypto-solicitation", /\b(send|transfer|deposit|invest)\b.{0,40}\b(btc|eth|usdt|bitcoin|ethereum|crypto|wallet)\b/i],
  ["crypto-returns",      /\b(guaranteed|instant|daily)\s+(returns?|profits?|income|earnings?)\b/i],
  ["crypto-address",      /\b(0x[a-f0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})\b/i],

  // Phishing / external redirects
  ["phishing-link",       /\b(click here|verify your|confirm your (account|identity)|suspended|unlock your)\b/i],
  ["suspicious-url",      /https?:\/\/(?!github\.com|npmjs\.com|crates\.io|docs\.|developer\.)[\w.-]+\.(xyz|tk|ml|ga|cf|gq|top|work|click|loan|win|download)\b/i],

  // Mass-post / duplicate spam signals
  ["mass-apply",          /\bi (can do|am able to) (any|all) (kind|type)s? of (work|project|task)/i],
  ["generic-spam-pitch",  /\b(cheap|affordable|best price|lowest rate|discount).{0,30}\b(service|offer|deal)\b/i],

  // Harassment / threats
  ["threat",              /\b(i (will|am going to)|gonna) (kill|hurt|destroy|doxx|hack|swat)\b/i],
  ["doxx",                /\b(home address|real name|i know where you (live|work))\b/i],

  // Repo spam signals
  ["fork-spam",           /\b(fork(ed)? from|no original|copy of|duplicate (of|repo))\b/i],

  // MLM / pyramid
  ["mlm",                 /\b(join (my|our) team|passive income|financial freedom|be your own boss|work from home).{0,60}\b(earn|make|income)\b/i],
];

// ── Profanity filter ──────────────────────────────────────────────────────────
// bad-words catches the obvious slurs and explicit terms.
// We add a small domain-specific supplement for tech-community harassment.
const EXTRA_WORDS = [
  "retard", "retards", "retarded",
  "faggot", "faggots",
  "tranny", "trannies",
  "nigger", "niggers",
  "kike", "kikes",
  "spic", "spics",
];

let _filter: Filter | null = null;
function getFilter(): Filter {
  if (!_filter) {
    _filter = new Filter({ emptyList: false });
    _filter.addWords(...EXTRA_WORDS);
  }
  return _filter;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function prefilter(text: string): PrefilterResult {
  const lower = text.toLowerCase();

  // 1. Custom regex rules (fast, specific)
  for (const [label, pattern] of SPAM_RULES) {
    if (pattern.test(lower)) {
      return { verdict: "spam", reason: `Matched rule: ${label}` };
    }
  }

  // 2. Profanity list (broad vocabulary coverage)
  try {
    if (getFilter().isProfane(text)) {
      return { verdict: "spam", reason: "Contains profanity or slurs" };
    }
  } catch {
    // bad-words throws on very short strings sometimes — ignore
  }

  return { verdict: "pass" };
}
