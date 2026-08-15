import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evidenceBase, versionMerit, computeLedger, verdictBand, summarize
} from '../src/index.js';
import { makeProtocol, makeDebate, seedMergedClaim, claim } from './helpers.js';

const ev = (...tiers) => tiers.map((tier, i) => ({ source: `S${i}`, url: 'https://example.org', tier }));
/** The same citations, with an arbiter's tier verification recorded. */
const evOk = (...tiers) => ev(...tiers).map(c => ({ ...c, tierVerified: true }));

test('evidenceBase: claim types that do not take citations', () => {
  // 1.1 lowered these so that an unsourced inference cannot price level with a
  // sourced finding. See SPEC 9 and test/hardening.test.js.
  assert.equal(evidenceBase({ type: 'logical', evidence: [] }), 2);
  assert.equal(evidenceBase({ type: 'definitional', evidence: [] }), 1);
});

test('evidenceBase: empirical with no citation scores zero', () => {
  assert.equal(evidenceBase({ type: 'empirical', evidence: [] }), 0);
});

test('evidenceBase: tolerates a missing evidence field', () => {
  assert.equal(evidenceBase({ type: 'empirical' }), 0);
});

test('evidenceBase: single citation uses its tier weight', () => {
  assert.equal(evidenceBase({ type: 'empirical', evidence: ev('T3') }), 3);
  // 1.1: an unverified tier above T3 scores at T3 until an arbiter checks it.
  assert.equal(evidenceBase({ type: 'empirical', evidence: ev('T1') }), 3);
  assert.equal(evidenceBase({ type: 'empirical', evidence: evOk('T1') }), 5);
});

test('evidenceBase: corroboration adds 0.5 per extra citation', () => {
  assert.equal(evidenceBase({ type: 'empirical', evidence: evOk('T1', 'T2') }), 5.5);
  // Unverified, both cap at T3, so the corroboration bonus is all that is left.
  assert.equal(evidenceBase({ type: 'empirical', evidence: ev('T1', 'T2') }), 3.5);
});

test('evidenceBase: the corroboration bonus is capped at +1.0', () => {
  assert.equal(evidenceBase({ type: 'empirical', evidence: ev('T3', 'T4', 'T5') }), 4);
  assert.equal(evidenceBase({ type: 'empirical', evidence: ev('T3', 'T4', 'T5', 'T5', 'T5') }), 4);
});

test('versionMerit: unassigned relevance counts as 1, not 0', () => {
  const d = { challenges: [] };
  const v = { id: 'v1', type: 'empirical', evidence: ev('T3'), qualifier: 'probable', relevance: null };
  const m = versionMerit(d, v);
  assert.equal(m.R, 1);
  assert.equal(+m.merit.toFixed(4), 2.7);
});

test('versionMerit: unknown qualifier falls back to the lowest weight', () => {
  const d = { challenges: [] };
  const m = versionMerit(d, { id: 'v1', type: 'logical', evidence: [], qualifier: 'wildly-confident' });
  assert.equal(m.Q, 0.75);
});

test('versionMerit: survival counts only dismissed challenges against this version', () => {
  const d = {
    challenges: [
      { versionId: 'v1', resolution: 'dismissed' },
      { versionId: 'v1', resolution: 'dismissed' },
      { versionId: 'v1', resolution: 'upheld' },
      { versionId: 'v1', resolution: null },
      { versionId: 'other', resolution: 'dismissed' }
    ]
  };
  const m = versionMerit(d, { id: 'v1', type: 'logical', evidence: [], qualifier: 'certain' });
  assert.equal(m.dismissed, 2);
  assert.equal(+m.S.toFixed(4), 1.2);
});

test('computeLedger: threads with no canonical version contribute nothing', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  seedMergedClaim(P, d, { side: 'A' });
  const { thread } = seedMergedClaim(P, d, { side: 'B' });
  thread.canonicalId = null;

  const ledger = computeLedger(d);
  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.totals.B, 0);
});

test('computeLedger: a dangling canonicalId is skipped rather than throwing', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  const { thread } = seedMergedClaim(P, d, { side: 'A' });
  thread.canonicalId = 'no-such-version';
  assert.doesNotThrow(() => computeLedger(d));
  assert.equal(computeLedger(d).rows.length, 0);
});

test('computeLedger: rows sort side A first, then merit descending', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  seedMergedClaim(P, d, { side: 'A', title: 'weak A', evidence: [{ source: 's', url: 'u', tier: 'T5' }] });
  seedMergedClaim(P, d, { side: 'A', title: 'strong A', evidence: [{ source: 's', url: 'u', tier: 'T1' }] });
  seedMergedClaim(P, d, { side: 'B', title: 'B claim' });

  const rows = computeLedger(d).rows;
  assert.deepEqual(rows.map(r => r.threadTitle), ['strong A', 'weak A', 'B claim']);
});

test('verdictBand: thresholds are strict less-than at every boundary', () => {
  assert.equal(verdictBand(0).key, 'unresolved');
  assert.equal(verdictBand(0.0999).key, 'unresolved');
  assert.equal(verdictBand(0.10).key, 'balance');
  assert.equal(verdictBand(0.2499).key, 'balance');
  assert.equal(verdictBand(0.25).key, 'clear');
  assert.equal(verdictBand(0.4999).key, 'clear');
  assert.equal(verdictBand(0.50).key, 'decisive');
  assert.equal(verdictBand(1).key, 'decisive');
});

test('verdictBand: a margin that is mathematically on a boundary lands in the upper band', () => {
  // A ledger of 2.70 against 3.60 is exactly a 25% margin, but the subtraction and
  // division produce 0.24999999999999997. Without rounding this would band as
  // `balance` and quietly hand the debate the wrong verdict.
  const raw = (3.6 - 2.7) / 3.6;
  assert.ok(raw < 0.25, 'the unrounded value really is below the threshold');
  assert.equal(verdictBand(raw).key, 'clear');
  assert.equal(summarize({ A: 2.7, B: 3.6 }).band.key, 'clear');

  const tenPercent = (1 - 0.9) / 1;
  assert.equal(verdictBand(tenPercent).key, 'balance');
});

test('verdictBand: rounding does not swallow a genuine near-boundary difference', () => {
  assert.equal(verdictBand(0.2499).key, 'balance');
  assert.equal(verdictBand(0.0999).key, 'unresolved');
  assert.equal(verdictBand(0.4999).key, 'clear');
});

test('summarize: an exact tie is unresolved with no winner', () => {
  const s = summarize({ A: 4, B: 4 });
  assert.equal(s.winner, null);
  assert.equal(s.band.key, 'unresolved');
  assert.equal(s.margin, 0);
});

test('summarize: an empty ledger does not divide by zero', () => {
  const s = summarize({ A: 0, B: 0 });
  assert.equal(s.margin, 0);
  assert.equal(s.winner, null);
});

test('summarize: a leader inside the unresolved band wins nothing', () => {
  const s = summarize({ A: 10, B: 9.5 });
  assert.equal(s.leader, 'A');
  assert.equal(s.winner, null);
  assert.equal(s.band.key, 'unresolved');
});

test('issueVerdict: freezes a ledger that later mutation cannot change', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  seedMergedClaim(P, d, { side: 'A' });
  seedMergedClaim(P, d, { side: 'B' });

  const v = P.issueVerdict(d, null);
  const rowsAtIssue = v.ledger.length;
  seedMergedClaim(P, d, { side: 'A', title: 'added later' });

  assert.equal(v.ledger.length, rowsAtIssue);
  assert.equal(computeLedger(d).rows.length, rowsAtIssue + 1);
});

test('issueVerdict: verdict numbers increment', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  seedMergedClaim(P, d, { side: 'A' });
  assert.equal(P.issueVerdict(d, null).n, 1);
  assert.equal(P.issueVerdict(d, null).n, 2);
});

test('issueVerdict: a rationale override is honored', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  seedMergedClaim(P, d, { side: 'A' });
  const v = P.issueVerdict(d, null, { rationale: () => 'custom text' });
  assert.equal(v.rationale, 'custom text');
});

test('the default rationale reports the computed totals and margin', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  seedMergedClaim(P, d, { side: 'A', evidence: [{ source: 's', url: 'u', tier: 'T1' }] });
  seedMergedClaim(P, d, { side: 'B', evidence: [{ source: 's', url: 'u', tier: 'T5' }] });
  const v = P.issueVerdict(d, null);
  assert.match(v.rationale, /prevails/);
  assert.match(v.rationale, new RegExp(`${(v.margin * 100).toFixed(1)}%`));
  assert.ok(!v.rationale.includes(String.fromCharCode(0x2014)), 'engine prose carries no em dashes');
});
