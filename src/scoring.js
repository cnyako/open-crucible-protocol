/**
 * The scoring rubric.
 *
 *   merit = E x R x S x Q
 *
 *   E  evidence base  max tier weight, plus 0.5 per additional citation, capped at +1.0
 *                     logical claims score 3, definitional claims score 2
 *   R  relevance      0.25, 0.5, 0.75 or 1.0, assigned by an arbiter at adjudication
 *   S  survival       1 + 0.1 per challenge dismissed against this version
 *   Q  qualifier      certain 1.0, probable 0.9, plausible 0.75
 *
 * A side's total is the sum of merit over its canonical versions. Demoted versions
 * score zero by construction: they are not canonical, so they never enter the ledger.
 *
 * All functions here are pure and take no environment.
 */

import { TIER_WEIGHT, QUAL_WEIGHT, VERDICT_BANDS, SURVIVAL_CAP } from './constants.js';

/**
 * Evidence base for a version.
 *
 * The additional-citation bonus is capped at +1.0 on purpose. Corroboration is
 * worth something, but a long bibliography should not outweigh the quality of the
 * best source in it.
 */
export function evidenceBase(v) {
  // An inference costs nothing to produce and cites nothing, so it must not
  // score level with a sourced finding. At 3 and 2 it did: a logical claim
  // matched a claim carrying a peer-reviewed study, which made unsourced
  // assertion the cheapest route to merit. See SPEC 9.
  if (v.type === 'logical') return 2;
  if (v.type === 'definitional') return 1;
  const evidence = v.evidence || [];
  if (!evidence.length) return 0;
  const maxWeight = Math.max(...evidence.map(e => effectiveTierWeight(e)));
  return maxWeight + Math.min(1, 0.5 * (evidence.length - 1));
}

/**
 * The weight a citation scores at, which is not always the tier it claims.
 *
 * Tier is asserted by the submitter, and E is the dominant factor in the rubric,
 * so an unchecked T1 is the largest single lever a participant can pull: moving
 * a citation from T3 to T1 multiplies that claim by about 1.67. A tier above T3
 * therefore scores at T3 until an arbiter records having checked the source, by
 * setting `tierVerified` on the citation during merge review.
 *
 * Deliberately not left to challenges. Challenges are scarce, and in practice
 * most citations are never examined by anyone.
 */
export function effectiveTierWeight(citation) {
  const claimed = TIER_WEIGHT[citation.tier] || 1;
  return citation.tierVerified ? claimed : Math.min(claimed, TIER_WEIGHT.T3);
}

/**
 * Merit of a single version, with its factors broken out so a host can show the
 * arithmetic. A verdict nobody can recompute is just an opinion with a number on it.
 *
 * An unassigned relevance counts as 1 rather than 0, so a version proposed before
 * adjudication is comparable against an incumbent during merge review.
 */
export function versionMerit(d, v) {
  const E = evidenceBase(v);
  const R = v.relevance != null ? v.relevance : 1;
  // Only challenges from the opposing side count toward survival. A side that
  // challenges its own claim and loses has proved nothing, and without this the
  // survival factor is farmable: two colluding accounts on opposite declared
  // sides could bank 10 percent a cycle, compounding, invisibly in the ledger.
  // Tolerates a document without threads: `versionMerit` is called with partial
  // documents by hosts comparing a candidate before it is attached to anything.
  const thread = (d.threads || []).find(t => t.id === v.threadId);
  const dismissed = d.challenges.filter(
    c => c.versionId === v.id
      && c.resolution === 'dismissed'
      && (!thread || c.side !== thread.side)
  ).length;
  // Capped. Survival is evidence that a claim held up, not an accumulator: an
  // unbounded multiplier rewards attracting challenges over being right.
  const S = Math.min(SURVIVAL_CAP, 1 + 0.1 * dismissed);
  const Q = QUAL_WEIGHT[v.qualifier] || 0.75;
  return { E, R, S, Q, dismissed, merit: E * R * S * Q };
}

/**
 * The ledger: one row per canonical version, plus each side's total.
 * Threads with no canonical version contribute nothing, which is how a demotion
 * removes a claim from the score without removing it from the record.
 */
export function computeLedger(d) {
  const rows = [];
  for (const t of d.threads) {
    if (!t.canonicalId) continue;
    const v = t.versions.find(x => x.id === t.canonicalId);
    if (!v) continue;
    const m = versionMerit(d, v);
    rows.push({
      side: t.side, threadId: t.id, threadTitle: t.title,
      versionId: v.id, versionNum: v.num, assertion: v.assertion,
      type: v.type, qualifier: v.qualifier, scoring: true, ...m
    });
  }

  rows.sort((a, b) => (a.side === b.side ? b.merit - a.merit : (a.side < b.side ? -1 : 1)));

  /**
   * The claim budget, applied after ranking.
   *
   * Rows beyond a side's budget stay in the ledger, and stay visible, with
   * `scoring: false` and a merit of zero in the totals. Dropping them would hide
   * the fact that a side made more claims than it could score, which is exactly
   * what a reader needs to see to understand the total.
   */
  const budget = d.claimBudget == null ? null : Math.max(0, Math.floor(d.claimBudget));
  const totals = { A: 0, B: 0 };
  const counted = { A: 0, B: 0 };

  for (const row of rows) {
    if (budget != null && counted[row.side] >= budget) {
      // Merit is left intact rather than zeroed. "Worth 4.95, outside the
      // budget" is a fact a reader should be able to see and recompute; a zero
      // would look like the claim failed on its merits.
      row.scoring = false;
      continue;
    }
    counted[row.side]++;
    totals[row.side] += row.merit;
  }

  return { rows, totals };
}

/**
 * Precision at which a margin is compared against a band threshold.
 *
 * Margins are computed from sums of products of decimal weights, so a case that is
 * mathematically exactly on a boundary usually is not exactly on it in binary. A
 * ledger of 2.70 against 3.60 is a margin of exactly 0.25, but `(3.6 - 2.7) / 3.6`
 * evaluates to 0.24999999999999997, which would fall into the band below and hand a
 * debate the wrong verdict for no reason a participant could ever see.
 *
 * Nine decimal places is far finer than any real ledger distinguishes and far
 * coarser than the representation error being corrected.
 */
const BAND_PRECISION = 1e9;

/**
 * Maps a margin to a verdict band. Comparison is strictly less than each threshold,
 * so a margin of exactly 0.10 is `balance` and exactly 0.25 is `clear`.
 */
export function verdictBand(margin) {
  const m = Math.round(margin * BAND_PRECISION) / BAND_PRECISION;
  const band = VERDICT_BANDS.find(b => m < b.max) || VERDICT_BANDS[VERDICT_BANDS.length - 1];
  return { key: band.key, label: band.label };
}

/**
 * Winner, margin and band derived from ledger totals.
 *
 * `burden` names the side that has to prove the resolution, and it is the reason
 * this function takes a second argument. Before 1.1 the field was declared at
 * framing, recorded permanently, and then ignored, so a proposition nobody had
 * established could be carried on a twelve percent margin. Now a side carrying
 * the burden must clear the unresolved band to win; an inconclusive ledger
 * resolves for the side that never had anything to prove.
 *
 * `shared` keeps the symmetric behaviour, and is the right setting for a
 * resolution where both sides assert something.
 *
 * Ties and empty ledgers remain unresolved under a shared burden.
 */
export function summarize(totals, burden = 'shared') {
  const hi = Math.max(totals.A, totals.B);
  const lo = Math.min(totals.A, totals.B);
  const margin = hi === 0 ? 0 : (hi - lo) / hi;
  const band = verdictBand(margin);
  const leader = totals.A === totals.B ? null : (totals.A > totals.B ? 'A' : 'B');

  if (band.key !== 'unresolved') {
    return { leader, winner: leader, margin, band, byBurden: false };
  }

  // Inconclusive. Under a shared burden that is where it ends; otherwise the
  // side without the burden prevails, because "not proven" is a win for them.
  if (burden === 'A' || burden === 'B') {
    const relieved = burden === 'A' ? 'B' : 'A';
    return { leader, winner: relieved, margin, band, byBurden: true };
  }

  return { leader, winner: null, margin, band, byBurden: false };
}
