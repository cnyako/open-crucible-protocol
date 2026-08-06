import test from 'node:test';
import assert from 'node:assert/strict';
import { ERR, canAppeal, canProposeVersion, APPEAL_PHASE } from '../src/index.js';
import { makeProtocol, makeDebate, seedMergedClaim, claim } from './helpers.js';

/** A closed debate carrying one verdict. */
function closedDebate() {
  const P = makeProtocol();
  const d = makeDebate(P);
  const a = seedMergedClaim(P, d, { side: 'A' });
  const b = seedMergedClaim(P, d, { side: 'B', evidence: [{ source: 'S', url: 'u', tier: 'T5' }] });
  a.version.relevance = 1;
  b.version.relevance = 1;
  P.issueVerdict(d, null);
  d.phase = 'closed';
  return { P, d, a, b };
}

function fileOn(P, d, threadIds, overrides = {}) {
  return P.fileAppeal(d, {
    side: 'B', author: 'appellant', ground: 'A1',
    justification: 'A source published after closure bears on the targeted thread.',
    evidence: [{ source: 'New study (2026)', url: 'https://example.org/new', tier: 'T2' }],
    targetThreadIds: threadIds, ...overrides
  });
}

test('appeals require a closed debate carrying a verdict', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  assert.equal(canAppeal(d, 'A').code, ERR.APPEAL_NOT_CLOSED);

  d.phase = 'closed';
  assert.equal(canAppeal(d, 'A').code, ERR.APPEAL_NO_VERDICT);
});

test('one appeal per side, but a denial does not consume the allowance', () => {
  const { P, d, b } = closedDebate();
  assert.equal(canAppeal(d, 'B'), null);

  const first = fileOn(P, d, [b.thread.id]);
  assert.equal(canAppeal(d, 'B').code, ERR.APPEAL_LIMIT_REACHED);

  P.decideAppeal(d, first, false, 'The ground is not made out.', 'arbiter');
  assert.equal(canAppeal(d, 'B'), null, 'a denied appeal may be refiled');
  assert.equal(d.phase, 'closed', 'denial leaves the debate closed');

  const second = fileOn(P, d, [b.thread.id]);
  assert.equal(canAppeal(d, 'B').code, ERR.APPEAL_LIMIT_REACHED,
    'a filed appeal consumes the allowance even before it is decided');

  P.decideAppeal(d, second, true, 'The ground is made out.', 'arbiter');
  assert.equal(canAppeal(d, 'B').code, ERR.APPEAL_NOT_CLOSED,
    'during a review the phase gate answers first');
});

test('the other side keeps its own appeal', () => {
  const { P, d, b } = closedDebate();
  fileOn(P, d, [b.thread.id]);
  assert.equal(canAppeal(d, 'A'), null);
});

test('an admitted appeal reopens only the threads it names', () => {
  const { P, d, a, b } = closedDebate();
  const appeal = fileOn(P, d, [b.thread.id]);
  assert.equal(P.decideAppeal(d, appeal, true, 'Post-closure source of higher tier.', 'arbiter'), null);

  assert.equal(d.phase, APPEAL_PHASE);
  assert.equal(d.activeAppealId, appeal.id);
  assert.equal(canProposeVersion(d, b.thread), true);
  assert.equal(canProposeVersion(d, a.thread), false, 'untargeted threads stay final');
});

test('appealTargets is a copy, so editing the appeal cannot widen a live review', () => {
  const { P, d, a, b } = closedDebate();
  const appeal = fileOn(P, d, [b.thread.id]);
  P.decideAppeal(d, appeal, true, 'Admitted.', 'arbiter');

  appeal.targetThreadIds.push(a.thread.id);
  assert.deepEqual(d.appealTargets, [b.thread.id]);
  assert.equal(canProposeVersion(d, a.thread), false);
});

test('an appeal cannot be decided twice', () => {
  const { P, d, b } = closedDebate();
  const appeal = fileOn(P, d, [b.thread.id]);
  P.decideAppeal(d, appeal, true, 'Admitted.', 'arbiter');

  const e = P.decideAppeal(d, appeal, false, 'Changed my mind.', 'arbiter');
  assert.equal(e.code, ERR.APPEAL_ALREADY_DECIDED);
  assert.equal(appeal.status, 'admitted');
});

test('concluding requires a review to be in progress', () => {
  const { P, d } = closedDebate();
  assert.equal(P.concludeAppealReview(d, 'arbiter').code, ERR.APPEAL_NOT_IN_REVIEW);
});

test('concluding is blocked by this cycle open challenges and pending candidates', () => {
  const { P, d, b } = closedDebate();
  const appeal = fileOn(P, d, [b.thread.id]);
  P.decideAppeal(d, appeal, true, 'Admitted.', 'arbiter');

  const c = P.fileChallenge(d, {
    threadId: b.thread.id, versionId: b.version.id, ground: 'counter-evidence',
    text: 'The new source contradicts the assertion.',
    evidence: [{ source: 'S', url: 'u', tier: 'T2' }], author: 'x', side: 'A'
  });
  assert.equal(P.concludeAppealReview(d, 'arbiter').code, ERR.APPEAL_OPEN_CHALLENGES);

  P.resolveChallenge(d, c, 'dismissed', 'It measures a different quantity.', 'arbiter');
  const pending = P.addVersion(d, b.thread, claim({ side: 'B', evidence: [{ source: 'S', url: 'u', tier: 'T1' }] }));
  assert.equal(P.concludeAppealReview(d, 'arbiter').code, ERR.APPEAL_PENDING_CANDIDATES);

  P.mergeVersion(d, b.thread, pending.id, 'stronger source admitted on appeal', 'arbiter');
  assert.equal(P.concludeAppealReview(d, 'arbiter'), null);
});

test('a stale challenge from the original cycle does not block a later appeal', () => {
  const { P, d, a, b } = closedDebate();
  d.challenges.push({
    id: 'stale', threadId: a.thread.id, versionId: a.version.id,
    ground: 'relevance', text: 'left open', evidence: [],
    author: 'x', side: 'B', response: null, resolution: null, rationale: '',
    appealId: null, createdAt: 0
  });

  const appeal = fileOn(P, d, [b.thread.id]);
  P.decideAppeal(d, appeal, true, 'Admitted.', 'arbiter');
  assert.equal(P.concludeAppealReview(d, 'arbiter'), null);
});

test('a pending candidate on an untargeted thread does not block concluding', () => {
  const { P, d, a, b } = closedDebate();
  const appeal = fileOn(P, d, [b.thread.id]);
  P.decideAppeal(d, appeal, true, 'Admitted.', 'arbiter');

  P.addVersion(d, a.thread, claim());
  assert.equal(P.concludeAppealReview(d, 'arbiter'), null);
});

test('concluding issues a revised verdict and closes the debate again', () => {
  const { P, d, b } = closedDebate();
  const appeal = fileOn(P, d, [b.thread.id]);
  P.decideAppeal(d, appeal, true, 'Admitted.', 'arbiter');

  const stronger = P.addVersion(d, b.thread, claim({ side: 'B', evidence: [{ source: 'S', url: 'u', tier: 'T1' }] }));
  P.mergeVersion(d, b.thread, stronger.id, 'admitted source raises the evidence base', 'arbiter');
  assert.equal(P.concludeAppealReview(d, 'arbiter'), null);

  assert.equal(d.verdicts.length, 2);
  assert.equal(d.verdicts[1].viaAppealId, appeal.id);
  assert.equal(appeal.status, 'resolved');
  assert.equal(d.phase, 'closed');
  assert.equal(d.activeAppealId, null);
  assert.deepEqual(d.appealTargets, []);
  assert.equal(d.verdicts[0].viaAppealId, null, 'the original verdict stays on the record');
});
