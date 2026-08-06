/**
 * Phases and their prerequisites.
 *
 * No phase has a clock. Asynchrony is the point: it removes time-pressure tactics
 * and it equalizes the cost of refutation against the cost of assertion, which in a
 * timed format is roughly an order of magnitude apart.
 */

import { PHASES, APPEAL_PHASE } from './constants.js';
import { addLog } from './model.js';
import { ERR, err } from './errors.js';

function pendingCandidates(d, threadFilter) {
  return d.threads
    .filter(t => (threadFilter ? threadFilter(t) : true))
    .reduce((n, t) => n + t.versions.filter(v => v.status === 'candidate').length, 0);
}

/**
 * Returns `null` when the current phase may advance, or an error explaining what is
 * still outstanding.
 */
export function phasePrereq(d) {
  switch (d.phase) {
    case 'framing': {
      if (!d.resolution || !d.positions.A || !d.positions.B) {
        return err(ERR.PHASE_PREREQ_UNMET, 'Resolution and both positions must be set.');
      }
      return null;
    }

    case 'construction': {
      const hasCanonical = s => d.threads.some(t => t.side === s && t.canonicalId);
      if (!hasCanonical('A') || !hasCanonical('B')) {
        return err(ERR.PHASE_PREREQ_UNMET,
          'Each side needs at least one merged claim on its main branch.');
      }
      const pending = pendingCandidates(d);
      if (pending) {
        return err(ERR.PHASE_PREREQ_UNMET,
          `${pending} candidate version(s) still await a merge decision.`);
      }
      return null;
    }

    case 'challenge': {
      const open = d.challenges.filter(c => !c.resolution).length;
      if (open) {
        return err(ERR.PHASE_PREREQ_UNMET, `${open} challenge(s) remain unresolved.`);
      }
      const pending = pendingCandidates(d);
      if (pending) {
        return err(ERR.PHASE_PREREQ_UNMET,
          `${pending} repair candidate(s) await a merge decision.`);
      }
      return null;
    }

    case 'steelman': {
      if (d.steelmans.A.status !== 'certified' || d.steelmans.B.status !== 'certified') {
        return err(ERR.PHASE_PREREQ_UNMET,
          'Both steelmans must be certified by the side they restate.');
      }
      return null;
    }

    case 'adjudication': {
      const missing = d.threads
        .filter(t => t.canonicalId)
        .map(t => t.versions.find(v => v.id === t.canonicalId))
        .filter(v => v && v.relevance == null);
      if (missing.length) {
        return err(ERR.PHASE_PREREQ_UNMET,
          `${missing.length} standing claim(s) still need a relevance weight.`);
      }
      return null;
    }

    case 'verdict': {
      if (!d.verdicts.length) {
        return err(ERR.PHASE_PREREQ_UNMET, 'Issue the verdict before closing.');
      }
      return null;
    }

    case 'closed':
      return err(ERR.PHASE_TERMINAL,
        'The debate is closed. It reopens only through an admitted appeal.');

    case APPEAL_PHASE:
      return err(ERR.PHASE_NOT_ADVANCEABLE,
        'An appeal review ends by concluding the appeal, not by advancing a phase.');

    default:
      return err(ERR.PHASE_NOT_ADVANCEABLE, 'This phase does not advance.');
  }
}

/**
 * Advances to the next phase when prerequisites are met.
 *
 * `appeal-review` is not a member of PHASES, so it is refused explicitly above
 * rather than being allowed to fall through to an index lookup that would wrap
 * around and silently reset a closed debate to framing.
 */
export function advancePhase(env, d, actor) {
  const blocked = phasePrereq(d);
  if (blocked) return blocked;
  const i = PHASES.indexOf(d.phase);
  if (i < 0 || i >= PHASES.length - 1) {
    return err(ERR.PHASE_NOT_ADVANCEABLE, 'This phase does not advance.');
  }
  d.phase = PHASES[i + 1];
  addLog(env, d, actor, null, 'phase-advanced', d.phase);
  return null;
}

/** Closes a debate that has a verdict. */
export function closeDebate(env, d, actor) {
  d.phase = 'closed';
  addLog(env, d, actor, null, 'debate-closed', 'record final; appeals only');
  return null;
}
