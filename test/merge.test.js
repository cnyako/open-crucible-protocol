import test from 'node:test';
import assert from 'node:assert/strict';
import { ERR, versionMerit } from '../src/index.js';
import { makeProtocol, makeDebate, claim } from './helpers.js';

const tier = t => [{ source: 'S', url: 'https://example.org', tier: t }];

function setup() {
  const P = makeProtocol();
  const d = makeDebate(P);
  const thread = P.createThread(d, 'A', 'Test claim', 'contributor');
  return { P, d, thread };
}

test('first merge needs no incumbent and sets the canonical version', () => {
  const { P, d, thread } = setup();
  const v = P.addVersion(d, thread, claim());
  assert.equal(P.mergeVersion(d, thread, v.id, 'first', 'arbiter'), null);
  assert.equal(v.status, 'merged');
  assert.equal(thread.canonicalId, v.id);
});

test('a stronger candidate supersedes the incumbent', () => {
  const { P, d, thread } = setup();
  const weak = P.addVersion(d, thread, claim({ evidence: tier('T3') }));
  P.mergeVersion(d, thread, weak.id, 'first', 'arbiter');
  const strong = P.addVersion(d, thread, claim({ evidence: tier('T1') }));

  assert.equal(P.mergeVersion(d, thread, strong.id, 'stronger', 'arbiter'), null);
  assert.equal(weak.status, 'superseded');
  assert.equal(strong.status, 'merged');
  assert.equal(thread.canonicalId, strong.id);
});

test('a weaker candidate is refused and leaves the incumbent untouched', () => {
  const { P, d, thread } = setup();
  const strong = P.addVersion(d, thread, claim({ evidence: tier('T1') }));
  P.mergeVersion(d, thread, strong.id, 'first', 'arbiter');
  const weak = P.addVersion(d, thread, claim({ evidence: tier('T5') }));

  const e = P.mergeVersion(d, thread, weak.id, 'attempt', 'arbiter');
  assert.equal(e.code, ERR.MERGE_NOT_ON_MERIT);
  assert.match(e.message, /does not exceed/);
  assert.equal(strong.status, 'merged');
  assert.equal(weak.status, 'candidate');
  assert.equal(thread.canonicalId, strong.id);
});

test('equal merit is refused: merge on merit means strictly greater', () => {
  const { P, d, thread } = setup();
  const first = P.addVersion(d, thread, claim({ evidence: tier('T3') }));
  P.mergeVersion(d, thread, first.id, 'first', 'arbiter');
  const identical = P.addVersion(d, thread, claim({ evidence: tier('T3') }));

  assert.equal(versionMerit(d, identical).merit, versionMerit(d, first).merit);
  const e = P.mergeVersion(d, thread, identical.id, 'attempt', 'arbiter');
  assert.equal(e.code, ERR.MERGE_NOT_ON_MERIT);
  assert.equal(thread.canonicalId, first.id);
});

test('a candidate with no relevance inherits the incumbent relevance', () => {
  const { P, d, thread } = setup();
  const first = P.addVersion(d, thread, claim({ evidence: tier('T3'), relevance: 0.75 }));
  P.mergeVersion(d, thread, first.id, 'first', 'arbiter');
  const next = P.addVersion(d, thread, claim({ evidence: tier('T1') }));
  assert.equal(next.relevance, null);

  assert.equal(P.mergeVersion(d, thread, next.id, 'stronger', 'arbiter'), null);
  assert.equal(next.relevance, 0.75, 'the arbiter-assigned weight carries forward');
});

test('an explicit relevance on the candidate is not overwritten', () => {
  const { P, d, thread } = setup();
  const first = P.addVersion(d, thread, claim({ evidence: tier('T3'), relevance: 0.25 }));
  P.mergeVersion(d, thread, first.id, 'first', 'arbiter');
  const next = P.addVersion(d, thread, claim({ evidence: tier('T1'), relevance: 1.0 }));
  P.mergeVersion(d, thread, next.id, 'stronger', 'arbiter');
  assert.equal(next.relevance, 1.0);
});

test('merging something that is not a candidate is refused', () => {
  const { P, d, thread } = setup();
  const v = P.addVersion(d, thread, claim());
  P.mergeVersion(d, thread, v.id, 'first', 'arbiter');

  const e = P.mergeVersion(d, thread, v.id, 'again', 'arbiter');
  assert.equal(e.code, ERR.MERGE_NOT_CANDIDATE);
  assert.equal(P.mergeVersion(d, thread, 'no-such-id', 'x', 'arbiter').code, ERR.MERGE_NOT_CANDIDATE);
});

test('rejection records a rationale and only applies to candidates', () => {
  const { P, d, thread } = setup();
  const v = P.addVersion(d, thread, claim());
  assert.equal(P.rejectVersion(d, thread, v.id, 'below the bar', 'arbiter'), null);
  assert.equal(v.status, 'rejected');
  assert.equal(v.mergeRationale, 'below the bar');
  assert.equal(P.rejectVersion(d, thread, v.id, 'again', 'arbiter').code, ERR.REJECT_NOT_CANDIDATE);
});

test('version numbers and parent links track the thread history', () => {
  const { P, d, thread } = setup();
  const v1 = P.addVersion(d, thread, claim());
  P.mergeVersion(d, thread, v1.id, 'first', 'arbiter');
  const v2 = P.addVersion(d, thread, claim({ evidence: tier('T1') }));

  assert.equal(v1.num, 1);
  assert.equal(v2.num, 2);
  assert.equal(v2.parentId, v1.id, 'a new version descends from the current canonical version');
});
