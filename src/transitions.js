/**
 * State transitions: merging, challenging, and the steelman gate.
 *
 * Writers mutate the debate in place and return `null` on success or an error
 * object on refusal. They do not throw. A refused merge is an ordinary protocol
 * outcome and the caller usually wants to show the reason, not handle an exception.
 */

import { versionMerit } from './scoring.js';
import { addLog } from './model.js';
import { ERR, err } from './errors.js';
import { CHALLENGE_GROUNDS } from './constants.js';

/**
 * Merges a candidate onto the side's main branch.
 *
 * The rule is strict: a candidate merges only when its merit strictly exceeds the
 * incumbent's. Equal merit is not enough, because "merge on merit" has to mean
 * something for a challenger to have to clear.
 *
 * A candidate with no relevance assigned inherits the incumbent's, so that a
 * mid-debate improvement to a claim does not silently reset a weight an arbiter
 * already considered.
 */
export function mergeVersion(env, d, thread, versionId, rationale, actor) {
  const v = thread.versions.find(x => x.id === versionId);
  if (!v || v.status !== 'candidate') {
    return err(ERR.MERGE_NOT_CANDIDATE, 'Only candidate versions can be merged.');
  }
  const incumbent = thread.canonicalId
    ? thread.versions.find(x => x.id === thread.canonicalId)
    : null;

  if (incumbent) {
    const candidateMerit = versionMerit(d, v).merit;
    const incumbentMerit = versionMerit(d, incumbent).merit;
    if (candidateMerit <= incumbentMerit) {
      return err(ERR.MERGE_NOT_ON_MERIT,
        `Candidate merit (${candidateMerit.toFixed(2)}) does not exceed the incumbent (${incumbentMerit.toFixed(2)}). Merge on merit only.`);
    }
    incumbent.status = 'superseded';
    if (v.relevance == null && incumbent.relevance != null) v.relevance = incumbent.relevance;
  }

  v.status = 'merged';
  v.mergeRationale = rationale || '';
  thread.canonicalId = v.id;
  addLog(env, d, actor, null, 'version-merged',
    `${thread.title} v${v.num}${incumbent ? ` supersedes v${incumbent.num}` : ''}`);
  return null;
}

/** Declines a candidate. The version stays in history with its rationale attached. */
export function rejectVersion(env, d, thread, versionId, rationale, actor) {
  const v = thread.versions.find(x => x.id === versionId);
  if (!v || v.status !== 'candidate') {
    return err(ERR.REJECT_NOT_CANDIDATE, 'Only candidate versions can be rejected.');
  }
  v.status = 'rejected';
  v.mergeRationale = rationale || '';
  addLog(env, d, actor, null, 'version-rejected', `${thread.title} v${v.num}`);
  return null;
}

/**
 * Files a challenge against a merged version on exactly one enumerated ground.
 * During an appeal review the challenge is stamped with the appeal that authorized
 * it, so a later cycle can tell its own open items from historical ones.
 */
export function fileChallenge(env, d, data) {
  const c = {
    id: env.newId('chl'),
    threadId: data.threadId,
    versionId: data.versionId,
    ground: data.ground,
    text: data.text,
    evidence: data.evidence || [],
    author: data.author,
    side: data.side,
    response: null,
    resolution: null,
    rationale: '',
    appealId: d.activeAppealId || null,
    createdAt: env.now()
  };
  d.challenges.push(c);
  const t = d.threads.find(x => x.id === c.threadId);
  addLog(env, d, c.author, c.side, 'challenge-filed',
    `${CHALLENGE_GROUNDS[c.ground] || c.ground} vs ${t ? t.title : c.threadId}`);
  return c;
}

/** Records the defending side's response to a challenge. */
export function respondChallenge(env, d, c, text, author, side) {
  c.response = { text, author, side, ts: env.now() };
  addLog(env, d, author, side, 'challenge-response', String(text).slice(0, 80));
  return null;
}

/**
 * Resolves a challenge.
 *
 * Upholding demotes the targeted version, but only when it is still the canonical
 * one: a challenge against a version that has already been superseded has nothing
 * left to remove from the main branch.
 *
 * A demotion empties the thread rather than closing it. Refutation is a failing
 * test, not a death sentence, and either side may propose a repaired version.
 */
export function resolveChallenge(env, d, c, resolution, rationale, actor) {
  if (c.resolution) {
    return err(ERR.CHALLENGE_ALREADY_RESOLVED, 'This challenge has already been resolved.');
  }
  c.resolution = resolution;
  c.rationale = rationale;
  const t = d.threads.find(x => x.id === c.threadId);
  addLog(env, d, actor, null, `challenge-${resolution}`,
    `${t ? t.title : c.threadId}: ${String(rationale).slice(0, 80)}`);

  if (resolution === 'upheld' && t) {
    const v = t.versions.find(x => x.id === c.versionId);
    if (v && t.canonicalId === v.id) {
      v.status = 'demoted';
      t.canonicalId = null;
      addLog(env, d, 'system', null, 'version-demoted',
        `${t.title} v${v.num} removed from main; thread reopened for repair`);
    }
  }
  return null;
}

/**
 * Submits a restatement of one side's canonical case, written by the other side.
 * `ofSide` is the side being restated, not the side writing.
 */
export function submitSteelman(env, d, ofSide, text, author, side) {
  d.steelmans[ofSide] = { text, author, side, status: 'submitted', note: '', ts: env.now() };
  addLog(env, d, author, side, 'steelman-submitted', `restatement of side-${ofSide} case`);
  return null;
}

/** The restated side accepts the restatement as a fair statement of its own case. */
export function certifySteelman(env, d, ofSide, actor, side) {
  d.steelmans[ofSide].status = 'certified';
  addLog(env, d, actor, side, 'steelman-certified', `side-${ofSide} case`);
  return null;
}

/** The restated side returns the restatement with reasons. */
export function returnSteelman(env, d, ofSide, note, actor, side) {
  d.steelmans[ofSide].status = 'returned';
  d.steelmans[ofSide].note = note;
  addLog(env, d, actor, side, 'steelman-returned', String(note).slice(0, 80));
  return null;
}
