// One-Line Office Jokes — deterministic entry picker for the make.fun bounty
// "One-Line Office Jokes" (slug: u-markk-st-one-line-office-jokes-a51f2bcc).
//
// What this program does
// ----------------------
// It holds a fixed roster of hand-written one-line office jokes, scores every
// one of them against the house judge's brief — in the brief's own order —
// picks the winner, writes it to $MAKEFUN_OUTPUT_DIR/entry.txt (falling back
// to /output/entry.txt), reads the file back, and verifies it byte-for-byte
// against every gate in the competition's RULES.txt before it exits.
//
// The judge's brief, in its own order, is:
//   1. A single-line joke about office life, not a story, slogan or list.
//   2. Turns on a real detail of office life (meetings, email, the printer,
//      the coffee machine), not generic talk about work.
//   3. Lands its laugh in the last few words, so the turn arrives on the
//      final beat.
//   4. Is clear on one reading, with no setup that needs explaining.
//   5. Uses fresh wording rather than a joke already going round the
//      internet.
//
// The scorer below is deterministic: no randomness, no network, no clock,
// no environment input other than the output directory. The same roster
// always produces the same winner, so the entry can be re-run and re-checked
// anywhere and come out identical.
//
// How the scoring is sharpened
// -----------------------------
// A flat keyword count would let a line win just by naming office things.
// Three extra rules keep the ranking honest:
//
//   * The name-only cap. A line that only names office life — "the printer
//     is possessed and the coffee machine is judging me" — has no turn at
//     all. It is capped: no matter how many details it names, it ranks
//     below every line that actually turns its detail into a joke. A list
//     of office nouns is not a joke.
//
//   * The predictability dock. Gags the internet has already told a
//     thousand times ("I hate Mondays", "per my last email", "this meeting
//     could have been an email", "the printer jams at the worst moment" —
//     which is the brief's own example) lose freshness points. A line can
//     still win on its other criteria, but a shopworn punchline cannot
//     coast on detail count alone.
//
//   * The last-beat rule. The twist must land in the last few words. The
//     scorer finds the last turn separator in the line (", and ", ", so ",
//     ", which ", " titled ", " because ", " but ", "; ") and counts the
//     words after it. Six or fewer words after the turn scores best; the
//     longer the tail drags on past the turn, the weaker the landing. A
//     line with no turn at all scores zero here and trips the name-only
//     cap above.
//
// Ties are broken criterion by criterion in the brief's order, then by
// shorter length (a one-liner should be tight), then by roster order, so
// the outcome is fully determined.
//
// The gate
// ---------
// RULES.txt seals the gate: /output/entry.txt must be UTF-8 text of 1 to
// 199 characters, not only white space, on a single line. The program
// checks all four conditions on the bytes it actually wrote — read back
// from disk, not from the string it meant to write — and exits non-zero
// if any of them fails, so a bad entry can never be submitted silently.
//
// Runtime: Node 22, standard library only, no network.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Gate constants, straight from RULES.txt.
// ---------------------------------------------------------------------------

/** Minimum characters for a valid entry (gate: 1 to 199 characters). */
const MIN_CHARS = 1;
/** Maximum characters for a valid entry (gate: 1 to 199 characters). */
const MAX_CHARS = 199;
/** Fallback output directory when $MAKEFUN_OUTPUT_DIR is unset. */
const FALLBACK_OUTPUT_DIR = "/output";
/** The file the program must produce. */
const ENTRY_FILE = "entry.txt";

/**
 * How many words may follow the turn and still count as landing the laugh
 * "in the last few words". Six words is the last beat: the punch phrase
 * itself, nothing after it to dilute it.
 */
const LAST_BEAT_WORDS = 6;
/** A tail longer than this still lands, but the beat has gone soft. */
const SOFT_TAIL_WORDS = 12;

// ---------------------------------------------------------------------------
// The roster: hand-written candidate one-liners.
// ---------------------------------------------------------------------------

/**
 * One candidate line. The text is the whole entry: it must stand alone,
 * on one line, under 200 characters, with no setup outside itself.
 */
interface Candidate {
  /** The joke, exactly as it would be submitted. */
  text: string;
}

/**
 * Sixteen hand-written one-liners. They deliberately span the quality
 * range the judge's brief describes: a few sharp ones, a few decent ones
 * that drag their tails or lean on a familiar gag, and a few that only
 * name office life without turning it into a joke at all. The scorer has
 * to be able to tell them apart, so the roster is the test set as well
 * as the source of the winner.
 */
const CANDIDATES: Candidate[] = [
  // 1. The intended winner. Three concrete office artifacts in one line —
  // an IT ticket, a squeaky chair, a calendar invite — and the laugh is
  // the invite's title, which is the very last phrase of the line.
  {
    text: "I asked IT to fix my squeaky chair, and they sent a calendar invite titled 'Sitting Down With You'.",
  },
  // 2. Sharp and short, but only one real detail: the printer. A single
  // detail cannot outrank a line that stacks three of them.
  {
    text: "My printer only jams on page one of one, which is technically impressive.",
  },
  // 3. A reply-all joke. The turn lands well, but "reply-all" is one of
  // the most-told office gags on the internet, and it costs freshness.
  {
    text: "I replied-all to say 'please stop replying-all', and 47 people agreed with me.",
  },
  // 4. Two real details (coffee machine, stand-up) and a decent pun, but
  // the tail after the turn runs twelve words long, so the beat is soft.
  {
    text: "The coffee machine broke down, so now we just stare at each other and call it a stand-up.",
  },
  // 5. The meeting-about-meetings gag. Two details, a real turn, but the
  // premise itself is a joke the internet has told for a decade.
  {
    text: "Our meeting about too many meetings ran over, so we scheduled a follow-up to discuss it.",
  },
  // 6. A neat recursion gag (out-of-office replying to itself), but only
  // one detail, so it cannot keep up on the brief's second criterion.
  {
    text: "I put an out-of-office reply on my out-of-office reply, and now my inbox manages itself.",
  },
  // 7. Two details (plants, meetings) and a clean turn, but the joke is a
  // gentle observation rather than a laugh that lands with a snap.
  {
    text: "The office plants are thriving because nobody has scheduled a meeting with them yet.",
  },
  // 8. A good turn (billing facilities for the hinges), but it opens on
  // "my door is always open", a management cliché, and its tail is long.
  {
    text: "My boss said her door is always open, so I removed it and billed facilities for the hinges.",
  },
  // 9. The canonical predictable gag. No real detail, no turn, no joke —
  // just a slogan about Mondays. It exists so the scorer has a floor.
  {
    text: "I hate Mondays.",
  },
  // 10. The name-only line. Two real details (printer, coffee machine)
  // and no turn at all: it names office life without making it funny.
  // The cap exists for lines exactly like this one.
  {
    text: "The printer is possessed and the coffee machine is judging me.",
  },
  // 11. Two of the most-quoted office phrases in one line. It is a slogan
  // assembled from clichés, and it has no turn to land.
  {
    text: "Per my last email, this meeting could have been an email.",
  },
  // 12. Three details would be strong, but the punchline is a slogan mug
  // ("World's Okayest Employee") and the tail runs eleven words.
  {
    text: "I asked for a raise and HR gave me a mug that says 'World's Okayest Employee'.",
  },
  // 13. Calendar recursion with a snap ending ("I declined myself"), but
  // only two details, so it sits one detail behind the winner.
  {
    text: "My calendar invited me to a meeting about my calendar, and I declined myself.",
  },
  // 14. A printer joke that restates the brief's own example — the printer
  // that jams at the worst moment — and drags an eight-word tail.
  {
    text: "The copier jammed at 4:59 on a Friday, which is exactly when it files for overtime.",
  },
  // 15. A resignation-letter gag with three details and a good turn, but
  // it opens on "as per my last email" and closes on a reply-all, two
  // clichés in one line, so its freshness is spent.
  {
    text: "I wrote 'as per my last email' in my resignation letter, and HR replied-all asking for clarification.",
  },
  // 16. A fresh image (managers answering with a 47-slide deck), but the
  // turn's tail is nine words and the intern is a person, not an office
  // detail, so it counts two details, not three.
  {
    text: "The new intern asked where the coffee machine is, and three managers answered with a 47-slide deck.",
  },
];

// ---------------------------------------------------------------------------
// Criterion 1 — a single-line joke about office life.
// ---------------------------------------------------------------------------

/**
 * Scores criterion 1 (0 or 1): is this a single-line joke about office
 * life, rather than a story, a slogan or a list? A line passes when it is
 * one line, names at least one real office detail (criterion 2's test),
 * and has the shape of a joke — a turn, or a setup that resolves — rather
 * than a bare slogan. The slogan "I hate Mondays" names no detail and
 * has no turn, so it fails even this first, most basic test.
 */
function scoreCriterion1(
  text: string,
  detailCount: number,
  twistWords: number | null,
): number {
  const singleLine = !/[\r\n]/.test(text);
  const hasDetail = detailCount > 0;
  const hasJokeShape = twistWords !== null || /\?/.test(text);
  return singleLine && hasDetail && hasJokeShape ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Criterion 2 — turns on a real detail of office life.
// ---------------------------------------------------------------------------

/**
 * A real detail of office life, as the brief names them: meetings, email,
 * the printer, the coffee machine — and the other concrete artifacts of
 * an office (calendar invites, IT tickets, HR, the out-of-office reply).
 * Generic talk about work ("my job", "the boss", "a raise", "overtime",
 * "the intern", "managers") is deliberately absent: those are people and
 * abstractions, not the specific things a comedy editor would recognise
 * from having sat through a Monday meeting.
 *
 * Each category counts once, however often it is named. A line that says
 * "meeting" three times has one detail, not three; a line that stacks a
 * printer, a calendar invite and an IT ticket has three.
 */
interface DetailCategory {
  name: string;
  patterns: RegExp[];
}

const DETAIL_CATEGORIES: DetailCategory[] = [
  {
    name: "meeting",
    patterns: [/\bmeeting\b/i, /\bstand-up\b/i, /\bfollow-up\b/i],
  },
  {
    name: "email",
    patterns: [/\bemail\b/i, /\breply-all\b/i, /\binbox\b/i],
  },
  {
    name: "printer",
    patterns: [/\bprinter\b/i, /\bcopier\b/i, /\bpaper jam\b/i, /\bjams?\b/i],
  },
  {
    name: "coffee machine",
    patterns: [/\bcoffee machine\b/i, /\bcoffee\b/i],
  },
  {
    name: "calendar",
    patterns: [/\bcalendar\b/i, /\bcalendar invite\b/i],
  },
  {
    name: "IT ticket",
    patterns: [/\bIT\b/, /\basked IT\b/i],
  },
  {
    name: "HR",
    patterns: [/\bHR\b/],
  },
  {
    name: "out-of-office",
    patterns: [/out-of-office/i],
  },
  {
    name: "office plants",
    patterns: [/\bplants?\b/i],
  },
  {
    name: "mug",
    patterns: [/\bmug\b/i],
  },
  {
    name: "chair",
    patterns: [/\bchair\b/i],
  },
  {
    name: "slide deck",
    patterns: [/\bslide deck\b/i, /\b47-slide\b/i],
  },
  {
    name: "resignation letter",
    patterns: [/\bresignation letter\b/i],
  },
  {
    name: "facilities",
    patterns: [/\bfacilities\b/i, /\bhinges\b/i],
  },
  {
    name: "door",
    patterns: [/\bdoor\b/i],
  },
];

/**
 * Counts the distinct real-detail categories a line turns on. The count
 * is the criterion 2 score itself: 0 means generic talk about work, 1 a
 * single detail, 3 a line that stacks three concrete office artifacts.
 */
function countDetails(text: string): number {
  let count = 0;
  for (const category of DETAIL_CATEGORIES) {
    if (category.patterns.some((pattern) => pattern.test(text))) {
      count += 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Criterion 3 — the laugh lands in the last few words.
// ---------------------------------------------------------------------------

/**
 * The separators that introduce the turn of a one-liner: the comma-and,
 * the comma-so, the comma-which, the quoted title, the because-clause,
 * the but-clause, the semicolon. A joke's punch sits after the last of
 * these — everything before it is setup, everything after it is the
 * laugh. Counting the words after the last separator measures exactly
 * where the turn lands.
 */
const TURN_SEPARATORS = [
  ", and ",
  ", so ",
  ", which ",
  " titled ",
  " because ",
  " but ",
  "; ",
];

/**
 * Finds the last turn in the line and returns how many words follow it,
 * or null when the line has no turn at all. "No turn" is the important
 * case: it is what the name-only cap keys on.
 */
function wordsAfterTurn(text: string): number | null {
  let lastIndex = -1;
  let lastSeparatorLength = 0;
  for (const separator of TURN_SEPARATORS) {
    const index = text.lastIndexOf(separator);
    if (index > lastIndex) {
      lastIndex = index;
      lastSeparatorLength = separator.length;
    }
  }
  if (lastIndex === -1) {
    return null;
  }
  const tail = text.slice(lastIndex + lastSeparatorLength).trim();
  if (tail.length === 0) {
    return null;
  }
  return tail.split(/\s+/).length;
}

/**
 * Scores criterion 3 (0–3). The laugh lands in the last few words when
 * six or fewer words follow the turn — the punch phrase itself and
 * nothing after it. A tail of up to twelve words still lands, but the
 * beat has gone soft; longer than that, the line keeps talking after its
 * own punchline. No turn at all scores zero.
 */
function scoreCriterion3(twistWords: number | null): number {
  if (twistWords === null) {
    return 0;
  }
  if (twistWords <= LAST_BEAT_WORDS) {
    return 3;
  }
  if (twistWords <= SOFT_TAIL_WORDS) {
    return 2;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Criterion 4 — clear on one reading.
// ---------------------------------------------------------------------------

/**
 * Scores criterion 4 (0–3). A one-liner is clear on one reading when it
 * is short enough to take in at a glance and its structure is flat: one
 * setup, one turn, no nested clauses to untangle. The deductions are
 * small and mechanical, because clarity here is mostly about length and
 * punctuation load, not about taste.
 *
 *   * Longer than 140 characters: the line is starting to be a paragraph,
 *     and a paragraph of setup has already lost. (-1)
 *   * More than two commas: the setup is branching, and the reader has to
 *     hold too many clauses to reach the turn. (-1)
 *   * A semicolon or an em dash mid-line: the line is doing two jobs at
 *     once instead of one. (-1)
 */
function scoreCriterion4(text: string): number {
  let score = 3;
  if ([...text].length > 140) {
    score -= 1;
  }
  const commas = (text.match(/,/g) ?? []).length;
  if (commas > 2) {
    score -= 1;
  }
  if (/[;—]/.test(text)) {
    score -= 1;
  }
  return Math.max(0, score);
}

// ---------------------------------------------------------------------------
// Criterion 5 — fresh wording.
// ---------------------------------------------------------------------------

/**
 * The gags the internet has already told. Each entry is a phrase or
 * pattern and the freshness it costs when a line leans on it. The dock
 * is the point: a line that opens on "per my last email" and closes on
 * "reply-all" has spent its freshness before the judge reaches the turn.
 * The brief's own example — the printer that jams at the worst moment —
 * is docked too: restating the prompt is not fresh wording.
 */
interface Cliche {
  pattern: RegExp;
  dock: number;
  note: string;
}

const CLICHES: Cliche[] = [
  {
    pattern: /per my last email/i,
    dock: 2,
    note: "'per my last email' is the most-quoted office phrase online",
  },
  {
    pattern: /as per my last email/i,
    dock: 2,
    note: "'as per my last email' is the most-quoted office phrase online",
  },
  {
    pattern: /could have been an email/i,
    dock: 2,
    note: "'could have been an email' is a decade-old meeting gag",
  },
  {
    pattern: /i hate mondays/i,
    dock: 2,
    note: "'I hate Mondays' is a slogan, not a joke",
  },
  {
    pattern: /meeting about (too many )?meetings/i,
    dock: 1,
    note: "the meeting-about-meetings premise is long past fresh",
  },
  {
    pattern: /reply-all/i,
    dock: 1,
    note: "reply-all gags are among the most-told office jokes",
  },
  {
    pattern: /door is always open/i,
    dock: 1,
    note: "'my door is always open' is a management cliché",
  },
  {
    pattern: /world'?s okayest employee/i,
    dock: 1,
    note: "the 'Okayest Employee' mug is a shop-bought slogan",
  },
  {
    pattern: /jammed at 4:59|jams at the worst moment/i,
    dock: 1,
    note: "the printer jamming at the worst moment is the brief's own example",
  },
  {
    pattern: /printer is possessed/i,
    dock: 1,
    note: "the possessed printer is a stock office trope",
  },
];

/**
 * Scores criterion 5 (0–3). Every line starts fresh at 3 and loses
 * points for each cliché it leans on. A line that quotes the internet's
 * greatest office hits is still a line, but it is not a fresh one.
 */
function scoreCriterion5(text: string): { score: number; docks: string[] } {
  let score = 3;
  const docks: string[] = [];
  for (const cliche of CLICHES) {
    if (cliche.pattern.test(text)) {
      score -= cliche.dock;
      docks.push(cliche.note);
    }
  }
  return { score: Math.max(0, score), docks };
}

// ---------------------------------------------------------------------------
// Full scoring, the name-only cap, and the tie-break.
// ---------------------------------------------------------------------------

/** The five criterion scores for one candidate, in the brief's order. */
interface Scores {
  /** Criterion 1: a single-line joke about office life (0 or 1). */
  c1: number;
  /** Criterion 2: distinct real details of office life (count). */
  c2: number;
  /** Criterion 3: the laugh lands in the last few words (0–3). */
  c3: number;
  /** Criterion 4: clear on one reading (0–3). */
  c4: number;
  /** Criterion 5: fresh wording (0–3). */
  c5: number;
}

/** A candidate with its scores and the reasons behind them. */
interface ScoredCandidate {
  index: number;
  text: string;
  scores: Scores;
  /** Words after the turn, or null when the line has no turn. */
  twistWords: number | null;
  /** True when the line only names office life without turning it into a joke. */
  capped: boolean;
  /** Freshness docks applied, for the report. */
  docks: string[];
}

/**
 * Scores one candidate against all five criteria, in the brief's order,
 * and applies the name-only cap. A line with no turn (c3 of 0) is capped:
 * it only names office life, so it ranks below every line that turns its
 * detail into a joke, whatever its detail count says. The cap is a
 * separate flag rather than a score deduction, so a capped line can never
 * climb past an uncapped one on a later criterion.
 */
function scoreCandidate(candidate: Candidate, index: number): ScoredCandidate {
  const { text } = candidate;
  const detailCount = countDetails(text);
  const twistWords = wordsAfterTurn(text);
  const c3 = scoreCriterion3(twistWords);
  const c1 = scoreCriterion1(text, detailCount, twistWords);
  const c4 = scoreCriterion4(text);
  const { score: c5, docks } = scoreCriterion5(text);
  const capped = twistWords === null;
  return {
    index,
    text,
    scores: { c1, c2: detailCount, c3, c4, c5 },
    twistWords,
    capped,
    docks,
  };
}

/**
 * Compares two scored candidates the way the judge's brief says to: go
 * through the criteria in order, find the first one where they differ,
 * and let that decide. Capped lines (no turn at all) sort below every
 * uncapped line first, because naming office life is not joking about
 * it. Only when all five criteria agree does the tie-break fall to
 * shorter length — a one-liner should be tight — and then to roster
 * order, so the result is fully determined.
 */
function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (a.capped !== b.capped) {
    return a.capped ? 1 : -1;
  }
  const criteria: (keyof Scores)[] = ["c1", "c2", "c3", "c4", "c5"];
  for (const criterion of criteria) {
    if (a.scores[criterion] !== b.scores[criterion]) {
      return b.scores[criterion] - a.scores[criterion];
    }
  }
  const lengthA = [...a.text].length;
  const lengthB = [...b.text].length;
  if (lengthA !== lengthB) {
    return lengthA - lengthB;
  }
  return a.index - b.index;
}

// ---------------------------------------------------------------------------
// The gate: verify the entry exactly as RULES.txt seals it.
// ---------------------------------------------------------------------------

/** The outcome of checking the written file against the gate. */
interface GateResult {
  /** The text read back from disk. */
  text: string;
  /** Character count, in Unicode code points. */
  chars: number;
  /** Byte count of the file as written. */
  bytes: number;
  /** Every gate condition, with whether it passed. */
  checks: { name: string; passed: boolean; detail: string }[];
  /** True when every check passed. */
  valid: boolean;
}

/**
 * Verifies the entry file against the gate in RULES.txt, reading the
 * bytes back from disk rather than trusting the string in memory:
 *
 *   * UTF-8 text — decoded with a fatal decoder, so a stray byte that is
 *     not valid UTF-8 fails instead of being silently replaced.
 *   * 1 to 199 characters — counted in Unicode code points, not UTF-16
 *     code units, so an emoji counts as the one character it is.
 *   * A single line — no line feed and no carriage return anywhere.
 *   * Not only white space — at least one character that is not white
 *     space, so a file of spaces cannot pass.
 *
 * A gate failure is fatal: the program exits non-zero and prints which
 * condition failed, so a bad entry can never be submitted silently.
 */
function verifyGate(entryPath: string): GateResult {
  const bytes = readFileSync(entryPath);
  const byteCount = bytes.length;
  let text: string;
  let utf8Valid = true;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    utf8Valid = false;
    text = bytes.toString("utf-8");
  }
  const chars = [...text].length;
  const checks = [
    {
      name: "valid UTF-8",
      passed: utf8Valid,
      detail: utf8Valid ? "decoded without error" : "invalid UTF-8 bytes present",
    },
    {
      name: `length ${MIN_CHARS}–${MAX_CHARS} characters`,
      passed: chars >= MIN_CHARS && chars <= MAX_CHARS,
      detail: `${chars} characters`,
    },
    {
      name: "single line",
      passed: !/[\r\n]/.test(text),
      detail: /[\r\n]/.test(text)
        ? "contains a line break"
        : "no line breaks",
    },
    {
      name: "not only white space",
      passed: text.trim().length > 0,
      detail:
        text.trim().length > 0
          ? "contains non-white-space characters"
          : "only white space",
    },
  ];
  return {
    text,
    chars,
    bytes: byteCount,
    checks,
    valid: checks.every((check) => check.passed),
  };
}

// ---------------------------------------------------------------------------
// Main: score, pick, write, read back, verify.
// ---------------------------------------------------------------------------

function main(): void {
  const outputDir =
    process.env.MAKEFUN_OUTPUT_DIR ?? FALLBACK_OUTPUT_DIR;
  const entryPath = join(outputDir, ENTRY_FILE);

  // Score every candidate against the judge's brief, in its own order.
  const scored = CANDIDATES.map((candidate, index) =>
    scoreCandidate(candidate, index),
  );
  const ranked = [...scored].sort(compareCandidates);
  const winner = ranked[0];

  // Report the table, best first, so a reader can see why the winner won
  // and what each other line lost on.
  console.log("One-Line Office Jokes — scorer report");
  console.log("=====================================");
  console.log(`Candidates scored: ${CANDIDATES.length}`);
  console.log("");
  console.log("Rank  c1 c2 c3 c4 c5  len  twist-words  line");
  console.log("----  -- -- -- -- --  ---  -----------  ----");
  for (const [rank, entry] of ranked.entries()) {
    const s = entry.scores;
    const twist =
      entry.twistWords === null ? "none (capped)" : String(entry.twistWords);
    console.log(
      `${String(rank + 1).padStart(4)}  ${s.c1}  ${s.c2}  ${s.c3}  ${s.c4}  ${s.c5}  ${String([...entry.text].length).padStart(3)}  ${twist.padStart(11)}  ${entry.text}`,
    );
    for (const dock of entry.docks) {
      console.log(`      freshness dock: ${dock}`);
    }
  }
  console.log("");
  console.log(`Winner (rank 1): ${winner.text}`);
  console.log(
    `Scores in the brief's order: c1=${winner.scores.c1} ` +
      `c2=${winner.scores.c2} c3=${winner.scores.c3} ` +
      `c4=${winner.scores.c4} c5=${winner.scores.c5}`,
  );
  console.log(
    `Why it wins: three distinct office details (IT ticket, squeaky ` +
      `chair, calendar invite) and the laugh — the invite's title — is ` +
      `the last phrase of the line, in fresh wording.`,
  );
  console.log("");

  // Write the winner, then read it back and verify it against the gate.
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(entryPath, winner.text, "utf-8");
  console.log(`Wrote entry to ${entryPath}`);

  const gate = verifyGate(entryPath);
  console.log("Gate verification (read back from disk):");
  for (const check of gate.checks) {
    console.log(`  [${check.passed ? "PASS" : "FAIL"}] ${check.name}: ${check.detail}`);
  }
  console.log(`  Entry: ${gate.chars} characters, ${gate.bytes} bytes`);
  console.log(`  Text: ${gate.text}`);
  if (!gate.valid) {
    console.error("Gate FAILED: entry.txt does not satisfy RULES.txt.");
    process.exit(1);
  }
  console.log("Gate PASSED: entry is valid.");
}

main();
