/**
 * A complete worked debate, built entirely through the public API.
 *
 * It runs framing to closed and then through one admitted appeal, exercising every
 * mechanism the protocol has: a version superseded on merit, a challenge dismissed,
 * a challenge upheld that demotes a claim, a repaired version that merges in its
 * place, both steelmans certified, a verdict computed from the ledger, and an
 * appeal on newly discovered evidence that recomputes it.
 *
 * The citations are placeholders on example.org. This file demonstrates protocol
 * mechanics, not any position about code review.
 *
 * Run it:  node examples/sample-debate.js
 */

import { createProtocol, fixedClock, counterIds, computeLedger } from '../src/index.js';

const cite = (source, tier) => ({ source, url: 'https://example.org/placeholder', tier });

export function buildSampleDebate(P) {
  const d = P.newDebate({
    resolution: 'Resolved: mandatory pre-merge code review reduces defect rates in software teams.',
    posA: 'Affirmative: review reduces defects',
    posB: 'Negative: the effect is small or offset by its costs',
    burden: 'A'
  });

  P.addDefinition(d, {
    term: 'defect rate',
    definition: 'Defects reported against a release per thousand lines of changed code, measured over the 90 days after merge.',
    author: 'contributor-a', side: 'A'
  });

  P.advancePhase(d, 'arbiter');

  // Side A, thread 1: opens at T3, then a stronger version supersedes it on merit.
  const tA1 = P.createThread(d, 'A', 'Measured defect reduction', 'contributor-a');
  const a1v1 = P.addVersion(d, tA1, {
    author: 'contributor-a', side: 'A', type: 'empirical',
    assertion: 'Teams that adopt mandatory pre-merge review report lower post-release defect rates.',
    grounds: 'A single-organization study reports a reduction in post-release defects after review became mandatory.',
    warrant: 'If the same teams show fewer defects after the practice changed, the practice is a plausible cause of the reduction.',
    evidence: [cite('Single-organization study (placeholder)', 'T3')],
    qualifier: 'plausible'
  });
  P.mergeVersion(d, tA1, a1v1.id, 'First compliant version on this thread. Single study at T3.', 'arbiter');

  const a1v2 = P.addVersion(d, tA1, {
    author: 'contributor-c', side: 'A', type: 'empirical',
    assertion: 'Teams that adopt mandatory pre-merge review report lower post-release defect rates.',
    grounds: 'A meta-analysis across multiple organizations reports a consistent reduction, and an independent multi-team cohort reproduces the direction of the effect.',
    warrant: 'If the reduction replicates across independent organizations, the practice is a plausible cause rather than an artifact of one setting.',
    evidence: [
      cite('Meta-analysis of review practices (placeholder)', 'T1'),
      cite('Multi-team cohort study (placeholder)', 'T2')
    ],
    qualifier: 'probable', relevance: 1.0
  });
  // 1.1: a tier above T3 scores at T3 until an arbiter checks the source, so
  // verification comes before the merge decision that depends on it.
  P.verifyTier(d, tA1, a1v2.id, 0, 'Retrieved: meta-analysis, methodology section reports pooled estimates across independent teams.', 'arbiter');
  P.verifyTier(d, tA1, a1v2.id, 1, 'Retrieved: multi-team cohort, sample and window reported.', 'arbiter');
  P.mergeVersion(d, tA1, a1v2.id,
    'Candidate raises the evidence base from a single T3 study to a verified T1 meta-analysis plus an independent verified T2 cohort. Merit exceeds the incumbent.',
    'arbiter');

  // Side A, thread 2.
  const tA2 = P.createThread(d, 'A', 'Knowledge transfer', 'contributor-a');
  const a2v1 = P.addVersion(d, tA2, {
    author: 'contributor-a', side: 'A', type: 'empirical',
    assertion: 'Review distributes familiarity with a codebase across more than one engineer.',
    grounds: 'A survey of engineering organizations reports higher measured bus-factor scores on repositories with mandatory review.',
    warrant: 'If more engineers are familiar with a given module, the team carries less risk from any single departure.',
    evidence: [cite('Engineering practices survey (placeholder)', 'T4')],
    qualifier: 'probable', relevance: 0.5
  });
  P.mergeVersion(d, tA2, a2v1.id, 'Compliant. Survey evidence at T4, scoped to what the survey measures.', 'arbiter');

  // Side B, thread 1: this one gets challenged successfully and repaired.
  const tB1 = P.createThread(d, 'B', 'Cycle time cost', 'contributor-b');
  const b1v1 = P.addVersion(d, tB1, {
    author: 'contributor-b', side: 'B', type: 'empirical',
    assertion: 'Mandatory review adds enough delay to merges to offset its defect benefit.',
    grounds: 'A practitioner blog post reports that review queues added several days to typical merges at the author organization.',
    warrant: 'If the delay is large enough, the throughput lost exceeds the value of the defects avoided.',
    evidence: [cite('Practitioner blog post (placeholder)', 'T5')],
    qualifier: 'probable', relevance: 0.75
  });
  P.mergeVersion(d, tB1, b1v1.id, 'Compliant in form. Enters at T5 pending stronger sourcing.', 'arbiter');

  // Side B, thread 2.
  const tB2 = P.createThread(d, 'B', 'Reviewer attention limits', 'contributor-b');
  const b2v1 = P.addVersion(d, tB2, {
    author: 'contributor-b', side: 'B', type: 'empirical',
    assertion: 'Defect detection in review falls sharply once a changeset exceeds a few hundred lines.',
    grounds: 'A controlled study of review sessions reports detection rates declining with changeset size beyond roughly 200 lines.',
    warrant: 'If detection depends on changeset size, a mandate alone does not produce the benefit attributed to it.',
    evidence: [cite('Controlled study of review sessions (placeholder)', 'T3')],
    qualifier: 'probable', relevance: 0.75
  });
  P.mergeVersion(d, tB2, b2v1.id, 'Peer-reviewed T3, assertion scoped to what the study measured.', 'arbiter');

  P.advancePhase(d, 'arbiter');

  // Challenge 1: dismissed, so the targeted version gains survival credit.
  const c1 = P.fileChallenge(d, {
    threadId: tA2.id, versionId: a2v1.id, ground: 'relevance',
    text: 'Distribution of familiarity is a staffing-risk property rather than a defect-rate property, so the claim does not bear on the resolution as framed.',
    evidence: [], author: 'contributor-b', side: 'B'
  });
  P.respondChallenge(d, c1,
    'The resolution concerns effects of the practice on teams, and the definition adopted at framing does not restrict the ledger to defect counts alone.',
    'contributor-a', 'A');
  P.resolveChallenge(d, c1, 'dismissed',
    'The claim bears on the resolution, though indirectly. Its relevance weight already reflects that distance.',
    'arbiter');

  // Challenge 2: upheld, demoting the version and reopening the thread.
  const c2 = P.fileChallenge(d, {
    threadId: tB1.id, versionId: b1v1.id, ground: 'evidence-validity',
    text: 'The cited source is a single unreviewed post that does not report its sample, its measurement window, or its baseline, so it cannot support a general claim about merge delay.',
    evidence: [cite('Cycle-time dataset across organizations (placeholder)', 'T3')],
    author: 'contributor-a', side: 'A'
  });
  P.respondChallenge(d, c2,
    'The direction of the effect is corroborated by the dataset the challenge itself cites, so the thread should be repaired rather than removed.',
    'contributor-b', 'B');
  P.resolveChallenge(d, c2, 'upheld',
    'The source does not document its sample and cannot support the generality asserted. The version is demoted and the thread reopens for repair.',
    'arbiter');

  const b1v2 = P.addVersion(d, tB1, {
    author: 'contributor-b', side: 'B', type: 'empirical',
    assertion: 'Mandatory review measurably increases time to merge.',
    grounds: 'A cross-organization cycle-time dataset reports longer median time to merge under mandatory review, with the increase concentrated in larger changesets.',
    warrant: 'If time to merge rises measurably, the practice carries a throughput cost that has to be weighed against its defect benefit.',
    evidence: [cite('Cycle-time dataset across organizations (placeholder)', 'T3')],
    qualifier: 'probable', relevance: 0.75
  });
  P.mergeVersion(d, tB1, b1v2.id,
    'Repair version replaces the failed source with the dataset named in the upheld challenge, and rescopes the assertion to what that dataset supports.',
    'arbiter');

  P.advancePhase(d, 'arbiter');

  // The steelman gate: each side restates the other, and the restated side certifies.
  P.submitSteelman(d, 'A',
    'The affirmative case holds that mandatory review is associated with lower post-release defect rates across independent organizations, and that it spreads familiarity with a codebase beyond a single engineer, so a team adopting it carries both fewer defects and less staffing risk.',
    'contributor-b', 'B');
  P.certifySteelman(d, 'A', 'contributor-a', 'A');

  P.submitSteelman(d, 'B',
    'The negative case holds that mandatory review measurably lengthens time to merge, and that its defect-detection benefit falls sharply once changesets exceed a few hundred lines, so the mandate alone does not deliver the benefit attributed to it and carries a throughput cost.',
    'contributor-a', 'A');
  P.certifySteelman(d, 'B', 'contributor-b', 'B');

  P.advancePhase(d, 'arbiter');
  P.advancePhase(d, 'arbiter');
  P.issueVerdict(d, null, { actor: 'arbiter' });
  P.closeDebate(d, 'arbiter');

  return { d, threads: { tA1, tA2, tB1, tB2 } };
}

/** Files and resolves an A1 appeal that adds a stronger source to a side B thread. */
export function runSampleAppeal(P, d, threadB) {
  const appeal = P.fileAppeal(d, {
    side: 'B', author: 'contributor-b', ground: 'A1',
    justification: 'A cohort study published after closure measures time to merge under mandatory review at a higher tier than the canonical citation on the targeted thread, and bears directly on it.',
    evidence: [cite('Post-closure cohort study (placeholder)', 'T2')],
    targetThreadIds: [threadB.id]
  });
  P.decideAppeal(d, appeal, true,
    'Ground A1 is satisfied. The source post-dates closure, exceeds the tier of the canonical citation on the named thread, and could plausibly move the verdict band.',
    'arbiter');

  const repaired = P.addVersion(d, threadB, {
    author: 'contributor-b', side: 'B', type: 'empirical',
    assertion: 'Mandatory review measurably increases time to merge.',
    grounds: 'A cross-organization cycle-time dataset reports longer median time to merge, and a cohort study published after this debate closed reproduces the increase on independent data.',
    warrant: 'If time to merge rises measurably and the finding replicates, the practice carries a throughput cost that has to be weighed against its defect benefit.',
    evidence: [
      cite('Post-closure cohort study (placeholder)', 'T2'),
      cite('Cycle-time dataset across organizations (placeholder)', 'T3')
    ],
    qualifier: 'probable', relevance: 0.75
  });
  // The appeal was admitted on the strength of this source, so the arbiter has
  // already read it. Recording the check is what makes it score at its tier.
  P.verifyTier(d, threadB, repaired.id, 0, 'Retrieved during appeal review: cohort study, independent data, post-closure.', 'arbiter');
  P.mergeVersion(d, threadB, repaired.id,
    'Appeal-cycle version adds the admitted and verified source to the existing citation, raising the evidence base.',
    'arbiter');
  P.concludeAppealReview(d, 'arbiter');
  return appeal;
}

// Running this file directly prints the ledger and both verdicts.
if (process.argv[1] && process.argv[1].endsWith('sample-debate.js')) {
  const P = createProtocol({ now: fixedClock(Date.UTC(2026, 0, 12, 9, 0, 0)), newId: counterIds() });
  const { d, threads } = buildSampleDebate(P);

  console.log(`\n${d.resolution}\n`);
  console.log('Verdict 1');
  console.log(`  ${d.verdicts[0].band.label}`);
  console.log(`  totals A ${d.verdicts[0].totals.A.toFixed(2)} / B ${d.verdicts[0].totals.B.toFixed(2)}`
    + `  margin ${(d.verdicts[0].margin * 100).toFixed(1)}%`);

  runSampleAppeal(P, d, threads.tB1);
  const v2 = d.verdicts[1];
  console.log('\nVerdict 2, after an admitted appeal on newly discovered evidence');
  console.log(`  ${v2.band.label}`);
  console.log(`  totals A ${v2.totals.A.toFixed(2)} / B ${v2.totals.B.toFixed(2)}`
    + `  margin ${(v2.margin * 100).toFixed(1)}%`);

  console.log('\nFinal ledger');
  for (const row of computeLedger(d).rows) {
    console.log(`  ${row.side}  ${row.merit.toFixed(2).padStart(5)}  ${row.threadTitle}`);
  }
  console.log(`\n${v2.rationale}\n`);
}
