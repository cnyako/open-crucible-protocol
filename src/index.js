/**
 * open-crucible-protocol
 *
 * A dependency-free engine for the Crucible Protocol: a structured, asynchronous,
 * version-controlled debate format in which facts, method, and argument quality
 * decide the outcome, and rhetorical skill has no scoring surface.
 *
 * Two kinds of export:
 *
 *   Pure functions and constants are importable directly. They read a debate
 *   document and compute; they never write.
 *
 *   Writers come from `createProtocol(env)`, which binds them to an injected clock
 *   and id generator. Pass nothing for production defaults, or pass `fixedClock`
 *   and `counterIds` in tests to make a whole debate record reproducible.
 *
 *     import { createProtocol, computeLedger } from 'open-crucible-protocol';
 *     const P = createProtocol();
 *     const debate = P.newDebate({ resolution: 'Resolved: ...', posA: '...', posB: '...' });
 *
 * See SPEC.md for the normative protocol definition.
 */

import { resolveEnv } from './env.js';
import * as model from './model.js';
import * as transitions from './transitions.js';
import * as phases from './phases.js';
import * as appeals from './appeals.js';
import { issueVerdict } from './verdict.js';

// Pure computation over a debate document.
export { evidenceBase, versionMerit, computeLedger, verdictBand, summarize } from './scoring.js';
export { generateRationale } from './rationale.js';
export { phasePrereq } from './phases.js';
export { canAppeal } from './appeals.js';
export { canOpenThread, canProposeVersion, canChallenge } from './permissions.js';
export { emptySteelman } from './model.js';
export { migrate } from './migrate.js';

// The Gate.
export {
  RULES, check,
  LEX, ACRONYM_WHITELIST, WORD_LIMITS, PICTOGRAPH_RE,
  wordCount, findPhrases, excerptAround,
  S_RULES, SCREEN_SYSTEM, parseSemanticScreenResponse,
  buildScreenRequest, fieldsToScreenText
} from './gate/index.js';

// Protocol vocabulary.
export {
  SCHEMA_VERSION, TIER_WEIGHT, TIER_LABEL, QUAL_WEIGHT, RELEVANCE_STEPS,
  PHASES, APPEAL_PHASE, CHALLENGE_GROUNDS, APPEAL_GROUNDS, VERDICT_BANDS,
  VERSION_STATUS, CLAIM_TYPES, SIDES
} from './constants.js';

// Environment and errors.
export { defaultEnv, defaultNewId, fixedClock, counterIds, resolveEnv } from './env.js';
export { ERR, err } from './errors.js';

/**
 * Binds every writer to an environment.
 *
 * @param {{now?:function():number, newId?:function(string):string}} [env]
 * @returns {object} writers, all of which mutate the debate document in place and
 *   return `null` on success or `{code, message}` on refusal
 */
export function createProtocol(env) {
  const e = resolveEnv(env);
  const bind = fn => (...args) => fn(e, ...args);

  return {
    env: e,

    // Document construction.
    newDebate: bind(model.newDebate),
    addLog: bind(model.addLog),
    createThread: bind(model.createThread),
    addVersion: bind(model.addVersion),
    addDefinition: bind(model.addDefinition),

    // Merging and challenging.
    mergeVersion: bind(transitions.mergeVersion),
    rejectVersion: bind(transitions.rejectVersion),
    fileChallenge: bind(transitions.fileChallenge),
    respondChallenge: bind(transitions.respondChallenge),
    resolveChallenge: bind(transitions.resolveChallenge),

    // The steelman gate.
    submitSteelman: bind(transitions.submitSteelman),
    certifySteelman: bind(transitions.certifySteelman),
    returnSteelman: bind(transitions.returnSteelman),

    // Phases and verdict.
    advancePhase: bind(phases.advancePhase),
    closeDebate: bind(phases.closeDebate),
    issueVerdict: bind(issueVerdict),

    // Appeals.
    fileAppeal: bind(appeals.fileAppeal),
    decideAppeal: bind(appeals.decideAppeal),
    concludeAppealReview: bind(appeals.concludeAppealReview)
  };
}
