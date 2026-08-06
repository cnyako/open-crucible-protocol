/**
 * Appeals: the falsifiability valve.
 *
 * A concluded debate must not become dogma, and it must not become a permanent
 * relitigation either. The compromise is narrow grounds and hard limits: three
 * enumerated grounds, one appeal per side, and a reopening scoped to the claim
 * threads the appeal actually names.
 *
 *   A1  newly discovered evidence
 *   A2  procedural error
 *   A3  source retraction or correction
 */

import { APPEAL_PHASE } from './constants.js';
import { addLog } from './model.js';
import { issueVerdict } from './verdict.js';
import { ERR, err } from './errors.js';

/**
 * Whether `side` may file an appeal now.
 *
 * A denied appeal does not consume the side's allowance: denial means the petition
 * failed to state a ground, not that the side has had its hearing.
 */
export function canAppeal(d, side) {
  if (d.phase !== 'closed') {
    return err(ERR.APPEAL_NOT_CLOSED, 'Appeals apply only to closed debates.');
  }
  if (!d.verdicts.length) {
    return err(ERR.APPEAL_NO_VERDICT, 'No verdict has been issued.');
  }
  if (d.appeals.some(a => a.side === side && a.status !== 'denied')) {
    return err(ERR.APPEAL_LIMIT_REACHED, `Side ${side} has used its one appeal.`);
  }
  return null;
}

export function fileAppeal(env, d, data) {
  const a = {
    id: env.newId('app'),
    side: data.side,
    author: data.author,
    ground: data.ground,
    justification: data.justification,
    evidence: data.evidence || [],
    targetThreadIds: [...(data.targetThreadIds || [])],
    status: 'filed',
    decisionRationale: '',
    filedAt: env.now()
  };
  d.appeals.push(a);
  addLog(env, d, a.author, a.side, 'appeal-filed', a.ground);
  return a;
}

/**
 * Admits or denies an appeal.
 *
 * Admitting moves the debate into appeal review and reopens exactly the threads the
 * appeal named. `targetThreadIds` is copied rather than aliased so that later edits
 * to the appeal record cannot silently widen the scope of a review already underway.
 */
export function decideAppeal(env, d, a, admit, rationale, actor) {
  if (a.status !== 'filed') {
    return err(ERR.APPEAL_ALREADY_DECIDED, 'This appeal has already been decided.');
  }
  a.status = admit ? 'admitted' : 'denied';
  a.decisionRationale = rationale;
  addLog(env, d, actor, null, admit ? 'appeal-admitted' : 'appeal-denied',
    String(rationale).slice(0, 80));

  if (admit) {
    d.phase = APPEAL_PHASE;
    d.appealTargets = [...a.targetThreadIds];
    d.activeAppealId = a.id;
  }
  return null;
}

/**
 * Ends an appeal review: recomputes the ledger, issues a revised verdict, and closes
 * the debate again. Both verdicts stay on the record with the appeal connecting them.
 */
export function concludeAppealReview(env, d, actor, options = {}) {
  if (d.phase !== APPEAL_PHASE || !d.activeAppealId) {
    return err(ERR.APPEAL_NOT_IN_REVIEW, 'No appeal review is in progress.');
  }
  const openChallenges = d.challenges.filter(
    c => c.appealId === d.activeAppealId && !c.resolution
  ).length;
  if (openChallenges) {
    return err(ERR.APPEAL_OPEN_CHALLENGES,
      `${openChallenges} appeal-cycle challenge(s) remain unresolved.`);
  }
  const pending = d.threads
    .filter(t => d.appealTargets.includes(t.id))
    .reduce((n, t) => n + t.versions.filter(v => v.status === 'candidate').length, 0);
  if (pending) {
    return err(ERR.APPEAL_PENDING_CANDIDATES,
      `${pending} candidate version(s) on reopened threads await a merge decision.`);
  }

  const appealId = d.activeAppealId;
  const a = d.appeals.find(x => x.id === appealId);
  issueVerdict(env, d, appealId, { ...options, actor });
  if (a) a.status = 'resolved';
  d.phase = 'closed';
  d.appealTargets = [];
  d.activeAppealId = null;
  addLog(env, d, actor, null, 'appeal-resolved', 'revised verdict issued; debate closed');
  return null;
}
