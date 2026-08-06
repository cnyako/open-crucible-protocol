/**
 * Advisory permission predicates.
 *
 * These answer "is this move appropriate in the current phase". They are ADVISORY
 * in this release: the writers in transitions.js and model.js do not call them, so
 * a host that wants phase enforcement has to check them itself before submitting.
 *
 * This is a deliberate v1 decision rather than an oversight. Enforcing phase rules
 * inside the writers would prevent a host from constructing a completed debate
 * record directly, which is exactly what fixtures, importers, and migrations from
 * other systems need to do. A `strict` mode that wires these into the writers is
 * planned; see CHANGELOG.md.
 */

import { APPEAL_PHASE } from './constants.js';

/** New claim threads may be opened during construction. */
export function canOpenThread(d) {
  return d.phase === 'construction';
}

/**
 * New versions may be proposed during construction, on a thread whose canonical
 * version was demoted (the repair path), or on a thread reopened by an appeal.
 */
export function canProposeVersion(d, thread) {
  if (d.phase === 'construction') return true;
  if (d.phase === 'challenge' && !thread.canonicalId) return true;
  if (d.phase === APPEAL_PHASE && d.appealTargets.includes(thread.id)) return true;
  return false;
}

/** Challenges may be filed against a thread that currently has a canonical version. */
export function canChallenge(d, thread) {
  if (!thread.canonicalId) return false;
  if (d.phase === 'challenge') return true;
  if (d.phase === APPEAL_PHASE && d.appealTargets.includes(thread.id)) return true;
  return false;
}
