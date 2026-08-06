/**
 * Verdict rationale.
 *
 * The rationale is generated from the ledger and from nothing else. That is the
 * whole design: a verdict is a statement about which claims survived and what they
 * scored, so its written justification has to be derivable from the same numbers a
 * reader can recompute.
 *
 * The default text is English. `issueVerdict` accepts a `rationale` override so a
 * host can localize or restyle without forking the protocol.
 */

const fmt = n => n.toFixed(2);

export function generateRationale(d, ledger, totals, winner, margin, band) {
  const pct = (margin * 100).toFixed(1);
  const sideName = s => `Side ${s} (${d.positions[s]})`;
  const rowsFor = s => ledger.rows.filter(r => r.side === s);
  const loser = winner === 'A' ? 'B' : 'A';

  let out;
  if (band.key === 'unresolved') {
    out = `The canonical cases total ${fmt(totals.A)} merit for Side A and ${fmt(totals.B)} for Side B, `
      + `a margin of ${pct}% and inside the 10% band. No winner is declared on current evidence. `;
  } else {
    out = `${sideName(winner)} prevails: ${band.label.toLowerCase()}. `
      + `Its canonical case totals ${fmt(totals[winner])} merit across ${rowsFor(winner).length} standing claims, `
      + `against ${fmt(totals[loser])} across ${rowsFor(loser).length}, a margin of ${pct}%. `;
  }

  const topA = rowsFor('A')[0];
  const topB = rowsFor('B')[0];
  if (topA) out += `Side A's strongest standing claim: "${topA.assertion}" (merit ${fmt(topA.merit)}). `;
  if (topB) out += `Side B's strongest standing claim: "${topB.assertion}" (merit ${fmt(topB.merit)}). `;

  const demotedCount = d.threads.reduce(
    (n, t) => n + t.versions.filter(v => v.status === 'demoted').length, 0
  );
  if (demotedCount) {
    out += `${demotedCount} version(s) were demoted after upheld challenges and score zero; `
      + `only claims that survived scrutiny appear in the ledger. `;
  }

  out += 'This verdict is computed from the pre-committed rubric '
    + '(evidence tier x relevance x challenge survival x qualifier) '
    + 'over the two main branches, and from nothing else.';
  return out;
}
