/**
 * Errors returned by protocol writers.
 *
 * Writers return `null` on success or an error object on refusal. They do not
 * throw: a refused merge or a blocked phase advance is an ordinary protocol
 * outcome, not an exceptional condition.
 *
 * The `code` is the stable contract. The `message` is human-readable and may be
 * reworded between releases, so do not assert on it.
 */

export const ERR = Object.freeze({
  MERGE_NOT_CANDIDATE: 'MERGE_NOT_CANDIDATE',
  MERGE_NOT_ON_MERIT: 'MERGE_NOT_ON_MERIT',
  REJECT_NOT_CANDIDATE: 'REJECT_NOT_CANDIDATE',
  CHALLENGE_ALREADY_RESOLVED: 'CHALLENGE_ALREADY_RESOLVED',
  PHASE_PREREQ_UNMET: 'PHASE_PREREQ_UNMET',
  PHASE_TERMINAL: 'PHASE_TERMINAL',
  PHASE_NOT_ADVANCEABLE: 'PHASE_NOT_ADVANCEABLE',
  APPEAL_NOT_CLOSED: 'APPEAL_NOT_CLOSED',
  APPEAL_NO_VERDICT: 'APPEAL_NO_VERDICT',
  APPEAL_LIMIT_REACHED: 'APPEAL_LIMIT_REACHED',
  APPEAL_ALREADY_DECIDED: 'APPEAL_ALREADY_DECIDED',
  APPEAL_NOT_IN_REVIEW: 'APPEAL_NOT_IN_REVIEW',
  APPEAL_OPEN_CHALLENGES: 'APPEAL_OPEN_CHALLENGES',
  APPEAL_PENDING_CANDIDATES: 'APPEAL_PENDING_CANDIDATES'
});

export function err(code, message) {
  return { code, message };
}
