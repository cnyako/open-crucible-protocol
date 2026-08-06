/**
 * Document constructors.
 *
 * A debate is a plain JSON object. It has no methods, no prototypes, and no
 * references to anything outside itself, so it can be stored, transmitted, diffed,
 * and replayed anywhere. Every function here mutates the document in place and
 * appends to its log.
 *
 * The document is the record. There is no state elsewhere.
 */

import { SCHEMA_VERSION } from './constants.js';

export function emptySteelman() {
  return { text: '', author: '', side: null, status: 'none', note: '', ts: null };
}

/**
 * Appends an entry to the permanent activity log.
 *
 * Log details store protocol keys, never display labels. A host renders keys into
 * whatever vocabulary its interface uses; the record stays stable across relabeling
 * and across languages.
 */
export function addLog(env, d, actor, side, action, detail) {
  d.log.push({ ts: env.now(), actor, side: side || null, action, detail });
  return d;
}

/**
 * Creates a debate in the framing phase.
 *
 * @param {{resolution:string, posA:string, posB:string, burden?:('A'|'B'|'shared')}} input
 */
export function newDebate(env, { resolution, posA, posB, burden }) {
  const d = {
    schemaVersion: SCHEMA_VERSION,
    id: env.newId('deb'),
    createdAt: env.now(),
    resolution,
    positions: { A: posA, B: posB },
    burden: burden || 'A',
    definitions: [],
    phase: 'framing',
    threads: [],
    challenges: [],
    steelmans: { A: emptySteelman(), B: emptySteelman() },
    verdicts: [],
    appeals: [],
    appealTargets: [],
    activeAppealId: null,
    log: []
  };
  addLog(env, d, 'system', null, 'debate-created', resolution);
  return d;
}

/**
 * Opens a claim thread for a side. A thread holds the ordered version history of a
 * single atomic point, and at most one canonical version at a time.
 */
export function createThread(env, d, side, title, actor) {
  const t = {
    id: env.newId('thr'),
    side, title,
    versions: [],
    canonicalId: null,
    createdAt: env.now()
  };
  d.threads.push(t);
  addLog(env, d, actor, side, 'thread-opened', title);
  return t;
}

/**
 * Proposes a new version in a thread. The version enters as a candidate: passing
 * the Gate makes a submission admissible, not canonical. Only a merge decision
 * puts it on the side's main branch.
 */
export function addVersion(env, d, thread, data) {
  const v = {
    id: env.newId('ver'),
    threadId: thread.id,
    num: thread.versions.length + 1,
    parentId: data.parentId || thread.canonicalId || null,
    author: data.author,
    side: data.side,
    type: data.type,
    assertion: data.assertion,
    grounds: data.grounds,
    warrant: data.warrant,
    evidence: data.evidence || [],
    qualifier: data.qualifier,
    status: 'candidate',
    relevance: data.relevance != null ? data.relevance : null,
    mergeRationale: '',
    createdAt: env.now()
  };
  thread.versions.push(v);
  addLog(env, d, v.author, v.side, 'version-proposed', `${thread.title} v${v.num}`);
  return v;
}

/** Records an agreed definition of a term used in the resolution. */
export function addDefinition(env, d, { term, definition, author, side }) {
  const entry = { term, definition, author, side };
  d.definitions.push(entry);
  addLog(env, d, author, side, 'definition-added', term);
  return entry;
}
