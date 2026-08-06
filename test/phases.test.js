import test from 'node:test';
import assert from 'node:assert/strict';
import { ERR, phasePrereq, PHASES, APPEAL_PHASE } from '../src/index.js';
import { makeProtocol, makeDebate, seedMergedClaim, claim } from './helpers.js';

/** A debate with one merged claim per side, both weighted, both steelmans certified. */
function readyDebate() {
  const P = makeProtocol();
  const d = makeDebate(P);
  const a = seedMergedClaim(P, d, { side: 'A' });
  const b = seedMergedClaim(P, d, { side: 'B' });
  a.version.relevance = 1;
  b.version.relevance = 1;
  P.submitSteelman(d, 'A', 'A restatement of side A.', 'contributor-b', 'B');
  P.certifySteelman(d, 'A', 'contributor-a', 'A');
  P.submitSteelman(d, 'B', 'A restatement of side B.', 'contributor-a', 'A');
  P.certifySteelman(d, 'B', 'contributor-b', 'B');
  return { P, d, a, b };
}

test('framing blocks without a resolution or without both positions', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  d.resolution = '';
  assert.equal(phasePrereq(d).code, ERR.PHASE_PREREQ_UNMET);

  d.resolution = 'Resolved: something.';
  d.positions.B = '';
  assert.equal(phasePrereq(d).code, ERR.PHASE_PREREQ_UNMET);

  d.positions.B = 'Negative';
  assert.equal(phasePrereq(d), null);
});

test('construction blocks until each side has a merged claim', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  d.phase = 'construction';
  seedMergedClaim(P, d, { side: 'A' });
  assert.match(phasePrereq(d).message, /at least one merged claim/);

  seedMergedClaim(P, d, { side: 'B' });
  assert.equal(phasePrereq(d), null);
});

test('construction blocks while any candidate awaits a merge decision', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  d.phase = 'construction';
  seedMergedClaim(P, d, { side: 'A' });
  const { thread } = seedMergedClaim(P, d, { side: 'B' });
  assert.equal(phasePrereq(d), null);

  P.addVersion(d, thread, claim({ side: 'B' }));
  assert.match(phasePrereq(d).message, /await a merge decision/);
});

test('challenge blocks on unresolved challenges, then on pending repairs', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  const a = seedMergedClaim(P, d, { side: 'A' });
  seedMergedClaim(P, d, { side: 'B' });
  d.phase = 'challenge';

  const c = P.fileChallenge(d, {
    threadId: a.thread.id, versionId: a.version.id, ground: 'relevance',
    text: 'The claim does not bear on the resolution.', evidence: [],
    author: 'challenger', side: 'B'
  });
  assert.match(phasePrereq(d).message, /challenge\(s\) remain unresolved/);

  P.resolveChallenge(d, c, 'upheld', 'It does not bear on the resolution.', 'arbiter');
  assert.equal(phasePrereq(d), null);

  P.addVersion(d, a.thread, claim());
  assert.match(phasePrereq(d).message, /repair candidate\(s\)/);
});

test('steelman blocks unless both restatements are certified', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  seedMergedClaim(P, d, { side: 'A' });
  seedMergedClaim(P, d, { side: 'B' });
  d.phase = 'steelman';
  assert.equal(phasePrereq(d).code, ERR.PHASE_PREREQ_UNMET);

  P.submitSteelman(d, 'A', 'Restatement of A.', 'b', 'B');
  assert.equal(phasePrereq(d).code, ERR.PHASE_PREREQ_UNMET, 'submitted is not certified');

  P.certifySteelman(d, 'A', 'a', 'A');
  P.submitSteelman(d, 'B', 'Restatement of B.', 'a', 'A');
  P.returnSteelman(d, 'B', 'This omits the cost argument.', 'b', 'B');
  assert.equal(phasePrereq(d).code, ERR.PHASE_PREREQ_UNMET, 'returned is not certified');

  P.submitSteelman(d, 'B', 'Restatement of B, revised.', 'a', 'A');
  P.certifySteelman(d, 'B', 'b', 'B');
  assert.equal(phasePrereq(d), null);
});

test('adjudication blocks until every standing claim has a relevance weight', () => {
  const { P, d, a } = readyDebate();
  d.phase = 'adjudication';
  assert.equal(phasePrereq(d), null);

  a.version.relevance = null;
  assert.match(phasePrereq(d).message, /need a relevance weight/);
});

test('verdict blocks until a verdict exists, and closed is terminal', () => {
  const { P, d } = readyDebate();
  d.phase = 'verdict';
  assert.match(phasePrereq(d).message, /Issue the verdict/);

  P.issueVerdict(d, null);
  assert.equal(phasePrereq(d), null);

  d.phase = 'closed';
  assert.equal(phasePrereq(d).code, ERR.PHASE_TERMINAL);
});

test('advancePhase walks the phase order and refuses past the end', () => {
  const { P, d } = readyDebate();
  const seen = [d.phase];
  for (let i = 0; i < PHASES.length; i++) {
    if (d.phase === 'verdict') P.issueVerdict(d, null);
    if (P.advancePhase(d, 'arbiter')) break;
    seen.push(d.phase);
  }
  assert.deepEqual(seen, [...PHASES]);
  assert.equal(P.advancePhase(d, 'arbiter').code, ERR.PHASE_TERMINAL);
});

test('advancePhase refuses from appeal-review instead of wrapping to framing', () => {
  const { P, d } = readyDebate();
  d.phase = APPEAL_PHASE;

  const e = P.advancePhase(d, 'arbiter');
  assert.equal(e.code, ERR.PHASE_NOT_ADVANCEABLE);
  assert.equal(d.phase, APPEAL_PHASE, 'a closed debate is not silently reset to framing');
});

test('phase-advanced is logged with the protocol key, not a display label', () => {
  const { P, d } = readyDebate();
  P.advancePhase(d, 'arbiter');
  const entry = d.log.filter(l => l.action === 'phase-advanced').pop();
  assert.equal(entry.detail, 'construction');
});
