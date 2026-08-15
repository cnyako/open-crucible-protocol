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

/**
 * Records that an arbiter checked a citation and that it is the tier it claims.
 *
 * Tier verification has to be a protocol action rather than a field a host sets
 * quietly, for the same reason every other arbiter decision is recorded: E is
 * the dominant factor in the rubric, so this is the single most consequential
 * judgment an arbiter makes about a claim, and a reader needs to see who made it.
 *
 * It also has to be available before a merge decision. An unverified tier above
 * T3 scores at T3, so a candidate that improves a claim by finding a better
 * source cannot beat its incumbent until someone confirms the source is what it
 * says. Verify first, then merge.
 */
export function verifyTier(env, d, thread, versionId, citationIndex, note, actor) {
  const v = thread.versions.find(x => x.id === versionId);
  if (!v) return err(ERR.VERSION_NOT_FOUND, 'No such version in this thread.');

  const citation = (v.evidence || [])[citationIndex];
  if (!citation) return err(ERR.CITATION_NOT_FOUND, 'No citation at that index.');

  citation.tierVerified = true;
  citation.tierVerifiedNote = note || '';
  addLog(env, d, actor, null, 'tier-verified',
    `${thread.title} v${v.num} citation ${citationIndex + 1} confirmed at ${citation.tier}`);
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
  /**
   * A challenge runs against the opposing side. SPEC 4 always said so and
   * nothing enforced it, which left the survival factor farmable: file a weak
   * challenge at your own claim, have it dismissed, bank the multiplier.
   * Scoring now ignores same-side dismissals as well, so this is the second of
   * two locks rather than the only one.
   */
  const target = d.threads.find(x => x.id === data.threadId);
  if (target && data.side && target.side === data.side) {
    return err(ERR.CHALLENGE_SAME_SIDE,
      'A challenge must be filed against the opposing side. A side cannot challenge its own claim.');
  }

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

/**
 * An arbiter certifies a restatement the restated side will not certify.
 *
 * Certification is a phase prerequisite, which made it a veto: a side with a
 * losing case could decline forever and deny its opponent a verdict. Bounding it
 * costs little, because the objection is recorded and the ideological Turing
 * test still has to have been attempted. `reason` is required and goes on the
 * record next to whatever the refusing side said.
 */
export function arbiterCertifySteelman(env, d, ofSide, reason, actor) {
  const s = d.steelmans[ofSide];
  if (s.status === 'none') {
    return err(ERR.STEELMAN_NOT_SUBMITTED,
      'No restatement has been submitted for this side, so there is nothing to certify.');
  }
  if (s.status === 'certified') return null;
  s.status = 'certified';
  s.certifiedBy = 'arbiter';
  s.arbiterReason = reason || '';
  addLog(env, d, actor, null, 'steelman-arbiter-certified',
    `side-${ofSide} case: ${String(reason || '').slice(0, 80)}`);
  return null;
}

/** The restated side returns the restatement with reasons. */
export function returnSteelman(env, d, ofSide, note, actor, side) {
  d.steelmans[ofSide].status = 'returned';
  d.steelmans[ofSide].note = note;
  addLog(env, d, actor, side, 'steelman-returned', String(note).slice(0, 80));
  return null;
}
