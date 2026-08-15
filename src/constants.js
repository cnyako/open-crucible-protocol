/**
 * Protocol vocabulary. These values are normative: they define the scoring rubric,
 * the phase order, and the enumerated grounds on which claims may be attacked.
 *
 * The rubric is fixed and published before any argument is submitted. That is the
 * point of it. The only way to score higher is to bring better evidence, a tighter
 * warrant, or a more relevant claim.
 */

export const SCHEMA_VERSION = 1;

/** Evidence tiers, adapted from GRADE. Higher weight means stronger evidence. */
export const TIER_WEIGHT = Object.freeze({ T1: 5, T2: 4, T3: 3, T4: 2, T5: 1 });

export const TIER_LABEL = Object.freeze({
  T1: 'Systematic review / replicated findings',
  T2: 'RCT / large cohort / official statistics',
  T3: 'Peer-reviewed study / institutional report',
  T4: 'Named expert analysis / vetted journalism / industry data',
  T5: 'Other documented, checkable source'
});

/**
 * Confidence qualifiers. Hedging is rewarded slightly relative to the demotion risk
 * that overclaiming carries under G12, which makes honest calibration the dominant
 * strategy rather than a virtue we have to ask for.
 */
export const QUAL_WEIGHT = Object.freeze({ certain: 1.0, probable: 0.9, plausible: 0.75 });

/** Relevance weights an arbiter may assign to a standing claim. */
export const RELEVANCE_STEPS = Object.freeze([0.25, 0.5, 0.75, 1.0]);

/** Phase order. `appeal-review` is deliberately not a member: it is entered only by
 *  an admitted appeal and exits back to `closed`. See phases.js. */
export const PHASES = Object.freeze([
  'framing', 'construction', 'challenge', 'steelman', 'adjudication', 'verdict', 'closed'
]);

export const APPEAL_PHASE = 'appeal-review';

/** The four grounds on which a merged claim version may be challenged. Nothing else
 *  is admissible. Free-form objection is not a move in this protocol. */
export const CHALLENGE_GROUNDS = Object.freeze({
  'evidence-validity': 'Evidence validity',
  'warrant-failure': 'Warrant failure',
  'relevance': 'Relevance',
  'counter-evidence': 'Counter-evidence'
});

/** The three grounds on which a closed debate may be reopened. */
export const APPEAL_GROUNDS = Object.freeze({
  A1: 'Newly discovered evidence',
  A2: 'Procedural error',
  A3: 'Source retraction or correction'
});

/**
 * Verdict bands, evaluated in order with a strict less-than comparison against the
 * margin. A margin below the first threshold is declared unresolved rather than
 * awarded to whoever happens to be ahead.
 */
export const VERDICT_BANDS = Object.freeze([
  { key: 'unresolved', max: 0.10, label: 'Unresolved: no winner on current evidence' },
  { key: 'balance', max: 0.25, label: 'Winner on balance of evidence' },
  { key: 'clear', max: 0.50, label: 'Clear winner' },
  { key: 'decisive', max: Infinity, label: 'Decisive winner' }
]);

/**
 * Ceiling on the survival multiplier, reached at three dismissed challenges.
 *
 * Survival is meant to record that a claim held up under scrutiny, not to pay a
 * bounty per attack survived. Uncapped it rewards a claim for attracting
 * challenges, which a determined pair of participants can arrange.
 */
export const SURVIVAL_CAP = 1.3;

/**
 * How many claims a side may score, when a debate declares a budget.
 *
 * Totals are sums, so without a budget the winning strategy is volume: eighteen
 * thin claims beat three strong ones, and padding the leading side also widens
 * the margin band. A budget scores each side's best N claims and leaves the rest
 * in the record, marked as not scoring. Null means no budget, which is the
 * pre-1.1 behaviour and is retained for documents written under it.
 */
export const DEFAULT_CLAIM_BUDGET = null;

/** Version lifecycle. */
export const VERSION_STATUS = Object.freeze({
  CANDIDATE: 'candidate',
  MERGED: 'merged',
  SUPERSEDED: 'superseded',
  DEMOTED: 'demoted',
  REJECTED: 'rejected'
});

export const CLAIM_TYPES = Object.freeze(['empirical', 'logical', 'definitional']);
export const SIDES = Object.freeze(['A', 'B']);
