/**
 * Schema migration.
 *
 * A debate document may have been written by an older version of this package and
 * stored for years. Reading one should never crash a renderer over a field that did
 * not exist yet, so `migrate` fills in absent structure without touching content.
 */

import { SCHEMA_VERSION } from './constants.js';
import { emptySteelman } from './model.js';

/**
 * Returns the same object, brought up to the current schema in place.
 * Safe to call on every load.
 */
export function migrate(d) {
  if (!d || typeof d !== 'object') return d;

  if (!Array.isArray(d.threads)) d.threads = [];
  if (!Array.isArray(d.challenges)) d.challenges = [];
  if (!Array.isArray(d.verdicts)) d.verdicts = [];
  if (!Array.isArray(d.appeals)) d.appeals = [];
  if (!Array.isArray(d.definitions)) d.definitions = [];
  if (!Array.isArray(d.appealTargets)) d.appealTargets = [];
  if (!Array.isArray(d.log)) d.log = [];
  if (!d.positions) d.positions = { A: '', B: '' };
  if (!d.steelmans) d.steelmans = { A: emptySteelman(), B: emptySteelman() };
  if (!d.steelmans.A) d.steelmans.A = emptySteelman();
  if (!d.steelmans.B) d.steelmans.B = emptySteelman();
  if (d.activeAppealId === undefined) d.activeAppealId = null;
  if (!d.phase) d.phase = 'framing';
  if (!d.burden) d.burden = 'A';

  for (const t of d.threads) {
    if (!Array.isArray(t.versions)) t.versions = [];
    if (t.canonicalId === undefined) t.canonicalId = null;
    for (const v of t.versions) {
      if (!Array.isArray(v.evidence)) v.evidence = [];
      if (v.relevance === undefined) v.relevance = null;
      if (!v.status) v.status = 'candidate';
    }
  }

  for (const c of d.challenges) {
    if (!Array.isArray(c.evidence)) c.evidence = [];
    if (c.resolution === undefined) c.resolution = null;
    if (c.appealId === undefined) c.appealId = null;
  }

  for (const a of d.appeals) {
    if (!Array.isArray(a.evidence)) a.evidence = [];
    if (!Array.isArray(a.targetThreadIds)) a.targetThreadIds = [];
  }

  d.schemaVersion = SCHEMA_VERSION;
  return d;
}
