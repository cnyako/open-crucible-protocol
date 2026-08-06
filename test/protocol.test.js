/**
 * End-to-end run of the sample debate under a fixed clock and reproducible ids.
 * This is the test that catches drift no unit test will.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProtocol, fixedClock, counterIds, computeLedger, migrate, SCHEMA_VERSION } from '../src/index.js';
import { buildSampleDebate, runSampleAppeal } from '../examples/sample-debate.js';

const T0 = Date.UTC(2026, 0, 12, 9, 0, 0);
const build = () => {
  const P = createProtocol({ now: fixedClock(T0), newId: counterIds() });
  return { P, ...buildSampleDebate(P) };
};

test('the sample debate reaches a closed record with one verdict', () => {
  const { d } = build();
  assert.equal(d.phase, 'closed');
  assert.equal(d.verdicts.length, 1);
  assert.equal(d.threads.length, 4);
  assert.equal(d.schemaVersion, SCHEMA_VERSION);
});

test('the ledger scores exactly the four canonical versions', () => {
  const { d } = build();
  const { rows, totals } = computeLedger(d);
  assert.equal(rows.length, 4);

  // A: meta-analysis T1 + cohort T2 => E 5.5, R 1.0, S 1.0, Q 0.9 => 4.95
  //    survey T4 => E 2, R 0.5, S 1.1 (one dismissed challenge), Q 0.9 => 0.99
  // B: repaired cycle-time T3 => E 3, R 0.75, S 1.0, Q 0.9 => 2.025
  //    review sessions T3 => E 3, R 0.75, S 1.0, Q 0.9 => 2.025
  assert.equal(+totals.A.toFixed(3), 5.94);
  assert.equal(+totals.B.toFixed(3), 4.05);

  const byTitle = Object.fromEntries(rows.map(r => [r.threadTitle, +r.merit.toFixed(3)]));
  assert.deepEqual(byTitle, {
    'Measured defect reduction': 4.95,
    'Knowledge transfer': 0.99,
    'Cycle time cost': 2.025,
    'Reviewer attention limits': 2.025
  });
});

test('the verdict lands in the clear band for side A', () => {
  const { d } = build();
  const v = d.verdicts[0];
  assert.equal(v.winner, 'A');
  assert.equal(v.band.key, 'clear');
  assert.equal((v.margin * 100).toFixed(1), '31.8');
  assert.equal(v.ledger.length, 4);
  assert.match(v.rationale, /prevails/);
});

test('the superseded and demoted versions stay in history and score nothing', () => {
  const { d, threads } = build();
  assert.deepEqual(threads.tA1.versions.map(v => v.status), ['superseded', 'merged']);
  assert.deepEqual(threads.tB1.versions.map(v => v.status), ['demoted', 'merged']);

  const scored = new Set(computeLedger(d).rows.map(r => r.versionId));
  for (const t of d.threads) {
    for (const v of t.versions) {
      if (v.status !== 'merged') assert.ok(!scored.has(v.id), `${v.status} version is not in the ledger`);
    }
  }
});

test('an admitted appeal recomputes the verdict and narrows the margin', () => {
  const { P, d, threads } = build();
  const before = d.verdicts[0];

  const appeal = runSampleAppeal(P, d, threads.tB1);

  assert.equal(d.verdicts.length, 2);
  const after = d.verdicts[1];
  assert.equal(after.viaAppealId, appeal.id);
  assert.equal(appeal.status, 'resolved');
  assert.equal(d.phase, 'closed');

  // B's cycle-time claim rises from E 3 to E 4.5, so 2.025 becomes 3.0375.
  assert.equal(+after.totals.B.toFixed(4), 5.0625);
  assert.equal(after.totals.A, before.totals.A);
  assert.ok(after.margin < before.margin, 'the appeal narrows the margin');
  assert.equal(after.band.key, 'balance');
  assert.equal(d.verdicts[0].margin, before.margin, 'the original verdict is unchanged');
});

test('the run is reproducible: same inputs give the same record', () => {
  const strip = o => JSON.stringify(o);
  const a = build();
  runSampleAppeal(a.P, a.d, a.threads.tB1);
  const b = build();
  runSampleAppeal(b.P, b.d, b.threads.tB1);
  assert.equal(strip(a.d), strip(b.d));
});

test('the log records the full protocol history in order', () => {
  const { P, d, threads } = build();
  runSampleAppeal(P, d, threads.tB1);
  const actions = d.log.map(l => l.action);

  for (const expected of [
    'debate-created', 'thread-opened', 'version-proposed', 'version-merged',
    'challenge-filed', 'challenge-response', 'challenge-dismissed', 'challenge-upheld',
    'version-demoted', 'steelman-submitted', 'steelman-certified', 'phase-advanced',
    'verdict-issued', 'debate-closed', 'appeal-filed', 'appeal-admitted', 'appeal-resolved'
  ]) {
    assert.ok(actions.includes(expected), `log contains ${expected}`);
  }
  assert.ok(actions.indexOf('version-demoted') < actions.indexOf('verdict-issued'));
  assert.ok(actions.lastIndexOf('verdict-issued') > actions.indexOf('appeal-admitted'));
});

test('every attribution is preserved on the record', () => {
  const { d } = build();
  for (const t of d.threads) {
    for (const v of t.versions) {
      assert.ok(v.author, 'every version names its author');
      assert.ok(['A', 'B'].includes(v.side), 'every version declares a side');
    }
  }
  for (const c of d.challenges) {
    assert.ok(c.author && ['A', 'B'].includes(c.side));
  }
});

test('a debate document survives a JSON round trip', () => {
  const { d } = build();
  const revived = JSON.parse(JSON.stringify(d));
  assert.deepEqual(computeLedger(revived).totals, computeLedger(d).totals);
});

test('migrate repairs a document missing later-added structure', () => {
  const { d } = build();
  const stale = JSON.parse(JSON.stringify(d));
  delete stale.appealTargets;
  delete stale.activeAppealId;
  delete stale.schemaVersion;
  delete stale.steelmans.B;
  stale.threads[0].versions[0].evidence = undefined;

  const fixed = migrate(stale);
  assert.deepEqual(fixed.appealTargets, []);
  assert.equal(fixed.activeAppealId, null);
  assert.equal(fixed.schemaVersion, SCHEMA_VERSION);
  assert.equal(fixed.steelmans.B.status, 'none');
  assert.deepEqual(fixed.threads[0].versions[0].evidence, []);
  assert.doesNotThrow(() => computeLedger(fixed));
});

test('migrate is safe on junk input', () => {
  assert.equal(migrate(null), null);
  assert.equal(migrate(undefined), undefined);
  assert.doesNotThrow(() => migrate({}));
});
