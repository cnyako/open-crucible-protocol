import { createProtocol, fixedClock, counterIds } from '../src/index.js';

export const T0 = Date.UTC(2026, 3, 6, 12, 0, 0);

/** A protocol instance with a reproducible clock and reproducible ids. */
export function makeProtocol() {
  return createProtocol({ now: fixedClock(T0), newId: counterIds() });
}

export function makeDebate(P, overrides = {}) {
  return P.newDebate({
    resolution: overrides.resolution || 'Resolved: the sample proposition holds.',
    posA: overrides.posA || 'Affirmative',
    posB: overrides.posB || 'Negative',
    burden: overrides.burden
  });
}

/** Minimal valid claim payload. Override any field per test. */
export function claim(overrides = {}) {
  return {
    author: 'contributor', side: 'A', type: 'empirical',
    assertion: 'The sample assertion states one atomic point.',
    grounds: 'The cited source reports the measurement described.',
    warrant: 'If the measurement holds then the assertion follows.',
    evidence: [{ source: 'Source (2024)', url: 'https://example.org/a', tier: 'T3' }],
    qualifier: 'probable',
    ...overrides
  };
}

/** Opens a thread and merges one version onto main. Returns { thread, version }. */
export function seedMergedClaim(P, d, overrides = {}) {
  const side = overrides.side || 'A';
  const thread = P.createThread(d, side, overrides.title || `Claim ${d.threads.length + 1}`, 'contributor');
  const version = P.addVersion(d, thread, claim({ ...overrides, side }));
  const e = P.mergeVersion(d, thread, version.id, 'seed merge', 'arbiter');
  if (e) throw new Error(`seed merge failed: ${e.code}`);
  return { thread, version };
}

/** Field list matching what a claim submission sends to the Gate. */
export function claimFields({ assertion = '', grounds = '', warrant = '' } = {}) {
  return [
    { name: 'assertion', label: 'Assertion', text: assertion, argumentative: true, required: true },
    { name: 'grounds', label: 'Grounds', text: grounds, argumentative: true, required: true },
    { name: 'warrant', label: 'Warrant', text: warrant, argumentative: true, required: true }
  ];
}

export function claimCtx(overrides = {}) {
  return {
    kind: 'claim', role: 'contributor', author: 'contributor', side: 'A',
    type: 'empirical', qualifier: 'probable', evidenceCount: 1, maxTierWeight: 3,
    ...overrides
  };
}

/** Rule ids present in a violation list. */
export function ruleIds(violations) {
  return [...new Set(violations.map(v => v.rule))].sort();
}
