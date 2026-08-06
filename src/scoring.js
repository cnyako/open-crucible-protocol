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

import { TIER_WEIGHT, QUAL_WEIGHT, VERDICT_BANDS } from './constants.js';

/**
 * Evidence base for a version.
 *
 * The additional-citation bonus is capped at +1.0 on purpose. Corroboration is
 * worth something, but a long bibliography should not outweigh the quality of the
 * best source in it.
 */
export function evidenceBase(v) {
  if (v.type === 'logical') return 3;
  if (v.type === 'definitional') return 2;
  const evidence = v.evidence || [];
  if (!evidence.length) return 0;
  const maxWeight = Math.max(...evidence.map(e => TIER_WEIGHT[e.tier] || 1));
  return maxWeight + Math.min(1, 0.5 * (evidence.length - 1));
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
  const dismissed = d.challenges.filter(
    c => c.versionId === v.id && c.resolution === 'dismissed'
  ).length;
  const S = 1 + 0.1 * dismissed;
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
  const totals = { A: 0, B: 0 };
  for (const t of d.threads) {
    if (!t.canonicalId) continue;
    const v = t.versions.find(x => x.id === t.canonicalId);
    if (!v) continue;
    const m = versionMerit(d, v);
    rows.push({
      side: t.side, threadId: t.id, threadTitle: t.title,
      versionId: v.id, versionNum: v.num, assertion: v.assertion,
      type: v.type, qualifier: v.qualifier, ...m
    });
    totals[t.side] += m.merit;
  }
  rows.sort((a, b) => (a.side === b.side ? b.merit - a.merit : (a.side < b.side ? -1 : 1)));
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

/** Winner, margin and band derived from ledger totals. Ties and empty ledgers are unresolved. */
export function summarize(totals) {
  const hi = Math.max(totals.A, totals.B);
  const lo = Math.min(totals.A, totals.B);
  const margin = hi === 0 ? 0 : (hi - lo) / hi;
  const band = verdictBand(margin);
  const leader = totals.A === totals.B ? null : (totals.A > totals.B ? 'A' : 'B');
  return { leader, winner: band.key === 'unresolved' ? null : leader, margin, band };
}
