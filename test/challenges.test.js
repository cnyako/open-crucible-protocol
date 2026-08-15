import test from 'node:test';
import assert from 'node:assert/strict';
import { ERR, versionMerit, APPEAL_PHASE } from '../src/index.js';
import { makeProtocol, makeDebate, seedMergedClaim, claim } from './helpers.js';

function challengeOn(P, d, thread, version, overrides = {}) {
  return P.fileChallenge(d, {
    threadId: thread.id, versionId: version.id,
    ground: 'warrant-failure', text: 'The inference does not hold as stated.',
    evidence: [], author: 'challenger', side: 'B', ...overrides
  });
}

test('an upheld challenge demotes the canonical version and empties the thread', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  const { thread, version } = seedMergedClaim(P, d);
  const c = challengeOn(P, d, thread, version);

  assert.equal(P.resolveChallenge(d, c, 'upheld', 'The warrant fails.', 'arbiter'), null);
  assert.equal(version.status, 'demoted');
  assert.equal(thread.canonicalId, null);
  assert.ok(d.log.some(l => l.action === 'version-demoted'));
});

test('an upheld challenge against a superseded version leaves the main branch alone', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  const thread = P.createThread(d, 'A', 'Claim', 'contributor');
  const v1 = P.addVersion(d, thread, claim({ evidence: [{ source: 'S', url: 'u', tier: 'T3' }] }));
  P.mergeVersion(d, thread, v1.id, 'first', 'arbiter');
  const v2 = P.addVersion(d, thread, claim({ evidence: [{ source: 'S', url: 'u', tier: 'T1' }] }));
  // 1.1: the upgrade only outscores the incumbent once the tier is verified.
  P.verifyTier(d, thread, v2.id, 0, 'Checked.', 'arbiter');
  P.mergeVersion(d, thread, v2.id, 'stronger', 'arbiter');

  const c = challengeOn(P, d, thread, v1);
  P.resolveChallenge(d, c, 'upheld', 'Against the old version.', 'arbiter');

  assert.equal(v1.status, 'superseded', 'a superseded version is not demoted again');
  assert.equal(thread.canonicalId, v2.id);
});

test('a dismissed challenge raises the survival factor', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  const { thread, version } = seedMergedClaim(P, d);
  const before = versionMerit(d, version).merit;

  const c = challengeOn(P, d, thread, version);
  P.resolveChallenge(d, c, 'dismissed', 'The objection targets a stronger claim than the version makes.', 'arbiter');

  const after = versionMerit(d, version);
  assert.equal(+after.S.toFixed(4), 1.1);
  assert.equal(+after.merit.toFixed(4), +(before * 1.1).toFixed(4));
  assert.equal(version.status, 'merged');
});

test('a challenge cannot be resolved twice', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  const { thread, version } = seedMergedClaim(P, d);
  const c = challengeOn(P, d, thread, version);

  assert.equal(P.resolveChallenge(d, c, 'dismissed', 'first', 'arbiter'), null);
  const e = P.resolveChallenge(d, c, 'upheld', 'second', 'arbiter');
  assert.equal(e.code, ERR.CHALLENGE_ALREADY_RESOLVED);
  assert.equal(c.resolution, 'dismissed', 'the original resolution stands');
});

test('challenges filed outside an appeal carry no appeal id', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  const { thread, version } = seedMergedClaim(P, d);
  d.phase = 'challenge';
  assert.equal(challengeOn(P, d, thread, version).appealId, null);
});

test('challenges filed during an appeal review are stamped with that appeal', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  const { thread, version } = seedMergedClaim(P, d);
  d.phase = APPEAL_PHASE;
  d.activeAppealId = 'app_1';
  assert.equal(challengeOn(P, d, thread, version).appealId, 'app_1');
});

test('a response is recorded against the challenge', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  const { thread, version } = seedMergedClaim(P, d);
  const c = challengeOn(P, d, thread, version);

  P.respondChallenge(d, c, 'The warrant is scoped to hours, not to output per hour.', 'defender', 'A');
  assert.equal(c.response.author, 'defender');
  assert.equal(c.response.side, 'A');
  assert.ok(c.response.ts);
});

test('a repaired version can merge onto a thread emptied by a demotion', () => {
  const P = makeProtocol();
  const d = makeDebate(P);
  const { thread, version } = seedMergedClaim(P, d, { evidence: [{ source: 'S', url: 'u', tier: 'T5' }] });
  const c = challengeOn(P, d, thread, version, { ground: 'evidence-validity' });
  P.resolveChallenge(d, c, 'upheld', 'The source cannot support the generality asserted.', 'arbiter');

  const repair = P.addVersion(d, thread, claim({ evidence: [{ source: 'Better', url: 'u', tier: 'T3' }] }));
  assert.equal(P.mergeVersion(d, thread, repair.id, 'repaired with a citable source', 'arbiter'), null);
  assert.equal(thread.canonicalId, repair.id);
  assert.equal(version.status, 'demoted', 'the demoted version stays demoted in history');
});
