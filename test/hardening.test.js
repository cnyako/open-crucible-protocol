/**
 * Conformance tests for the 1.1 hardening rules.
 *
 * Each of these corresponds to a finding in an adversarial audit of 1.0. They
 * are written as attacks: the test describes what a participant trying to win
 * would do, and asserts that the rubric no longer pays for it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evidenceBase, effectiveTierWeight, computeLedger, summarize, versionMerit } from '../src/scoring.js';
import { ERR } from '../src/errors.js';
import { makeProtocol } from './helpers.js';

const P = makeProtocol();

/** A citation, optionally already verified by an arbiter. */
function cite(source, tier, verified = false) {
  const c = { source, url: `https://example.org/${encodeURIComponent(source)}`, tier };
  if (verified) c.tierVerified = true;
  return c;
}

function debate(options = {}) {
  return P.newDebate({
    resolution: 'Resolved: the thing holds.',
    posA: 'Affirmative',
    posB: 'Negative',
    ...options
  });
}

function claim(d, side, title, over = {}) {
  const t = P.createThread(d, side, title, `contributor-${side.toLowerCase()}`);
  const v = P.addVersion(d, t, {
    author: `contributor-${side.toLowerCase()}`,
    side,
    type: 'empirical',
    assertion: 'The measured quantity moved in the stated direction.',
    grounds: 'The cited source reports the movement.',
    warrant: 'A reported measurement supports a claim about the measurement.',
    evidence: [cite('A source', 'T3')],
    qualifier: 'probable',
    ...over
  });
  P.mergeVersion(d, t, v.id, 'Only compliant version.', 'arbiter');
  return { thread: t, version: v };
}

// -- Finding B: unsourced inference must not price like sourced evidence ------

test('a logical claim no longer scores level with a peer-reviewed study', () => {
  const logical = evidenceBase({ type: 'logical' });
  const sourced = evidenceBase({ type: 'empirical', evidence: [cite('x', 'T3')] });
  assert.ok(logical < sourced,
    `unsourced inference (${logical}) must score below a T3 citation (${sourced})`);
  assert.equal(logical, 2);
  assert.equal(evidenceBase({ type: 'definitional' }), 1);
});

// -- Finding E: an asserted tier is not a verified tier -----------------------

test('a tier above T3 scores at T3 until an arbiter verifies the source', () => {
  assert.equal(effectiveTierWeight({ tier: 'T1' }), 3);
  assert.equal(effectiveTierWeight({ tier: 'T1', tierVerified: true }), 5);
  // Below the ceiling, verification changes nothing.
  assert.equal(effectiveTierWeight({ tier: 'T4' }), 2);
  assert.equal(effectiveTierWeight({ tier: 'T4', tierVerified: true }), 2);
});

test('claiming T1 without verification buys nothing over claiming T3', () => {
  const unverified = evidenceBase({ type: 'empirical', evidence: [cite('x', 'T1')] });
  const honest = evidenceBase({ type: 'empirical', evidence: [cite('x', 'T3')] });
  assert.equal(unverified, honest);
});

// -- Finding D: the survival factor is not farmable ---------------------------

test('a side cannot challenge its own claim', () => {
  const d = debate();
  const { thread, version } = claim(d, 'A', 'A first claim');
  P.advancePhase(d, 'arbiter');
  claim(d, 'B', 'B first claim');
  P.advancePhase(d, 'arbiter');

  const refusal = P.fileChallenge(d, {
    threadId: thread.id,
    versionId: version.id,
    ground: 'relevance',
    text: 'A deliberately weak objection filed against my own claim.',
    evidence: [],
    author: 'contributor-a',
    side: 'A'
  });

  assert.equal(refusal.code, ERR.CHALLENGE_SAME_SIDE);
  assert.equal(d.challenges.length, 0, 'the challenge must not enter the record');
});

test('a same-side dismissal does not raise survival even if one is present', () => {
  const d = debate();
  const { thread, version } = claim(d, 'A', 'A first claim');

  // Written straight into the document, bypassing the writer, which is what a
  // non-conforming implementation or a hand-edited record would look like.
  d.challenges.push({
    id: 'chl_smuggled', threadId: thread.id, versionId: version.id,
    ground: 'relevance', text: 'weak', evidence: [],
    author: 'contributor-a', side: 'A', response: null,
    resolution: 'dismissed', rationale: 'not persuasive', appealId: null, createdAt: 0
  });

  assert.equal(versionMerit(d, version).S, 1, 'survival must ignore same-side dismissals');
});

test('survival is capped, so attracting challenges is not a strategy', () => {
  const d = debate();
  const { thread, version } = claim(d, 'A', 'A first claim');
  for (let i = 0; i < 8; i++) {
    d.challenges.push({
      id: `chl_${i}`, threadId: thread.id, versionId: version.id,
      ground: 'relevance', text: 'objection', evidence: [],
      author: 'contributor-b', side: 'B', response: null,
      resolution: 'dismissed', rationale: 'survives', appealId: null, createdAt: 0
    });
  }
  assert.equal(versionMerit(d, version).S, 1.3);
});

// -- Finding A: volume must not beat quality ---------------------------------

test('a claim budget scores each side\'s best N and keeps the rest visible', () => {
  const d = debate({ claimBudget: 2 });
  claim(d, 'A', 'A strong', { evidence: [cite('x', 'T1'), cite('y', 'T2')] });
  claim(d, 'A', 'A middling');
  claim(d, 'A', 'A padding one', { qualifier: 'plausible' });
  claim(d, 'A', 'A padding two', { qualifier: 'plausible' });
  claim(d, 'B', 'B only');

  const { rows, totals } = computeLedger(d);

  const scoring = rows.filter(r => r.side === 'A' && r.scoring);
  const parked = rows.filter(r => r.side === 'A' && !r.scoring);
  assert.equal(scoring.length, 2, 'exactly the budget scores');
  assert.equal(parked.length, 2, 'the rest stay in the ledger');
  assert.ok(parked.every(r => r.merit > 0), 'parked rows keep their merit, they are not zeroed');
  assert.equal(totals.A, scoring.reduce((n, r) => n + r.merit, 0));

  // The two that score are the two highest, not the two submitted first.
  const best = [...rows].filter(r => r.side === 'A').sort((a, b) => b.merit - a.merit).slice(0, 2);
  assert.deepEqual(scoring.map(r => r.threadTitle).sort(), best.map(r => r.threadTitle).sort());
});

test('padding a case with thin claims cannot change the verdict under a budget', () => {
  const strong = debate({ claimBudget: 3 });
  claim(strong, 'A', 'A1', { evidence: [cite('x', 'T1', true), cite('y', 'T2', true)] });
  claim(strong, 'A', 'A2', { evidence: [cite('x', 'T1', true), cite('y', 'T2', true)] });
  claim(strong, 'B', 'B1', { type: 'logical', evidence: [] });

  const before = computeLedger(strong).totals.B;
  for (let i = 0; i < 15; i++) claim(strong, 'B', `B pad ${i}`, { type: 'logical', evidence: [] });
  const after = computeLedger(strong).totals.B;

  assert.ok(after <= before * 3,
    'a budget of 3 bounds what padding can add, where an unbudgeted ledger would grow without limit');
  assert.equal(computeLedger(strong).rows.filter(r => r.side === 'B' && r.scoring).length, 3);
});

// -- Finding C: the burden decides an unresolved ledger -----------------------

test('an unresolved margin resolves against the side carrying the burden', () => {
  const totals = { A: 10, B: 9.5 };  // margin 0.05, unresolved
  assert.equal(summarize(totals, 'shared').winner, null);

  const a = summarize(totals, 'A');
  assert.equal(a.winner, 'B', 'A had to prove it and did not separate itself');
  assert.equal(a.byBurden, true);
  assert.equal(a.band.key, 'unresolved', 'the band still reports what the ledger showed');

  const b = summarize(totals, 'B');
  assert.equal(b.winner, 'A');
  assert.equal(b.byBurden, true);
});

test('a decided margin ignores the burden entirely', () => {
  const totals = { A: 10, B: 4 };  // margin 0.6, decisive
  for (const burden of ['A', 'B', 'shared']) {
    const s = summarize(totals, burden);
    assert.equal(s.winner, 'A');
    assert.equal(s.byBurden, false);
  }
});

test('the verdict records that the burden decided it', () => {
  const d = debate({ burden: 'A' });
  claim(d, 'A', 'A claim');
  claim(d, 'B', 'B claim');
  const v = P.issueVerdict(d, null, { actor: 'arbiter' });
  assert.equal(v.band.key, 'unresolved', 'identical claims produce an unresolved ledger');
  assert.equal(v.winner, 'B');
  assert.equal(v.byBurden, true);
});

// -- Finding I: certification cannot be a veto -------------------------------

test('an arbiter can certify a restatement a side refuses to certify', () => {
  const d = debate();
  P.submitSteelman(d, 'A', 'A fair restatement of the A case.', 'contributor-b', 'B');
  const refusal = P.arbiterCertifySteelman(d, 'A', 'Side A declined twice without stating a defect.', 'arbiter');
  assert.equal(refusal, null);
  assert.equal(d.steelmans.A.status, 'certified');
  assert.equal(d.steelmans.A.certifiedBy, 'arbiter');
  assert.ok(d.log.some(e => e.action === 'steelman-arbiter-certified'));
});

test('an arbiter cannot certify a restatement nobody has written', () => {
  const d = debate();
  const refusal = P.arbiterCertifySteelman(d, 'A', 'reason', 'arbiter');
  assert.equal(refusal.code, ERR.STEELMAN_NOT_SUBMITTED);
});

// -- Backwards compatibility --------------------------------------------------

test('a document with no claim budget scores every canonical claim, as in 1.0', () => {
  const d = debate();
  assert.equal(d.claimBudget, null);
  claim(d, 'A', 'one');
  claim(d, 'A', 'two');
  claim(d, 'A', 'three');
  const { rows, totals } = computeLedger(d);
  assert.ok(rows.filter(r => r.side === 'A').every(r => r.scoring));
  assert.equal(totals.A, rows.filter(r => r.side === 'A').reduce((n, r) => n + r.merit, 0));
});

test('a nonsense claim budget is treated as no budget, not as a trap', () => {
  // A budget below one would score nobody, resolve every debate by burden
  // default, and look like a scoring bug rather than a bad input.
  for (const bad of [0, -3, 2.5, NaN]) {
    const d = debate({ claimBudget: bad });
    assert.equal(d.claimBudget, null, `claimBudget ${bad} must clamp to null`);
  }
  assert.equal(debate({ claimBudget: 3 }).claimBudget, 3);
  assert.equal(debate({}).claimBudget, null);
});
