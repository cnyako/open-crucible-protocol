/**
 * Verdict issuance.
 *
 * A verdict freezes the ledger at the moment it is issued. Later versions, later
 * challenges and later appeals produce new verdicts; they never edit an old one.
 * Every verdict a debate has ever carried stays on the record, which is what makes
 * an appeal an addition to the history rather than a rewrite of it.
 */

import { computeLedger, summarize } from './scoring.js';
import { generateRationale } from './rationale.js';
import { addLog } from './model.js';

/**
 * @param {object} d debate document
 * @param {string|null} viaAppealId appeal that prompted this verdict, if any
 * @param {{rationale?:function, actor?:string}} [options]
 */
export function issueVerdict(env, d, viaAppealId, options = {}) {
  const ledger = computeLedger(d);
  const { totals } = ledger;
  const { winner, margin, band, byBurden } = summarize(totals, d.burden);
  const writeRationale = options.rationale || generateRationale;

  const v = {
    n: d.verdicts.length + 1,
    issuedAt: env.now(),
    winner,
    totals: { ...totals },
    margin,
    band,
    rationale: writeRationale(d, ledger, totals, winner, margin, band),
    ledger: ledger.rows,
    /** True when the ledger was inconclusive and the declared burden decided it. */
    byBurden: Boolean(byBurden),
    viaAppealId: viaAppealId || null
  };
  d.verdicts.push(v);
  addLog(env, d, options.actor || 'arbiter', null, 'verdict-issued',
    `v${v.n}: ${winner ? `side-${winner}:${band.key}` : 'unresolved'}`);
  return v;
}
