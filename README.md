# open-crucible-protocol

A dependency-free engine for the **Crucible Protocol**: a structured, asynchronous,
version-controlled debate format in which evidence and argument quality decide the
outcome, and rhetorical skill has no surface to act on.

Traditional debate scores the wrong thing. Audiences reward confidence over
calibration, an attack on a scientist damages a claim about as much as an attack on
its evidence, refuting a bad argument costs roughly ten times what making one costs,
and every competitive format eventually optimizes for its own scoring rule rather
than for being right. Those are not failures of etiquette that better participants
would fix. They are properties of the format.

This protocol changes the format. Arguments are decomposed into cited, structured
claims. Every input passes an admissibility gate before it can enter the record.
Claims are versioned like source code, and the strongest version of each claim gets
merged into its side's canonical case. The verdict is computed from a rubric that was
published before anyone submitted anything, and it can be recomputed by any reader.

## The model

A debate is a pair of repositories.

| git | Crucible |
| --- | --- |
| repository | a side's case |
| file | claim thread, one atomic point |
| commit | claim version: assertion, grounds, warrant, citations, qualifier |
| branch | competing candidate versions |
| CI check | **the Gate**, rules G1 to G14 |
| code review and merge | promotion to the canonical case, on merit only |
| issue | challenge, on one of four enumerated grounds |
| revert | demotion after an upheld challenge |
| main branch | the only thing the verdict is computed from |

Anyone may contribute to either side, provided they declare which side they are
advocating for. Contributions are evaluated on content alone; authorship is recorded
permanently but never enters a merge decision. Competition inside a side replaces
gatekeeping over who is allowed to speak.

## Install

```bash
npm install open-crucible-protocol
```

Or vendor `src/` directly. It is plain ES modules with no dependencies, no build
step, and no network calls, and it runs unchanged in Node 20+ and in browsers.

## Use

```js
import { createProtocol, check, computeLedger } from 'open-crucible-protocol';

const P = createProtocol();

const debate = P.newDebate({
  resolution: 'Resolved: mandatory pre-merge code review reduces defect rates.',
  posA: 'Affirmative',
  posB: 'Negative'
});

// Everything passes the Gate before it can enter the record.
const fields = [
  { name: 'assertion', label: 'Assertion', text: 'Review reduces post-release defects.', argumentative: true, required: true },
  { name: 'grounds', label: 'Grounds', text: 'A meta-analysis reports a consistent reduction.', argumentative: true, required: true },
  { name: 'warrant', label: 'Warrant', text: 'If the reduction replicates, the practice is a plausible cause.', argumentative: true, required: true }
];
const violations = check(fields, {
  kind: 'claim', author: 'jo', side: 'A', type: 'empirical',
  qualifier: 'probable', evidenceCount: 1, maxTierWeight: 5
});
if (violations.length) {
  // Each violation names its rule, quotes the text, and says how to fix it.
  console.log(violations);
}

const thread = P.createThread(debate, 'A', 'Measured defect reduction', 'jo');
const version = P.addVersion(debate, thread, {
  author: 'jo', side: 'A', type: 'empirical',
  assertion: 'Review reduces post-release defects.',
  grounds: 'A meta-analysis reports a consistent reduction.',
  warrant: 'If the reduction replicates, the practice is a plausible cause.',
  evidence: [{ source: 'Meta-analysis (2024)', url: 'https://example.org/', tier: 'T1' }],
  qualifier: 'probable'
});

// Writers return null on success, or {code, message} on refusal.
const refusal = P.mergeVersion(debate, thread, version.id, 'First compliant version.', 'arbiter');

computeLedger(debate); // { rows, totals: { A, B } }
```

Run the full worked example, which goes from framing through a verdict and then
through an appeal that changes the verdict band:

```bash
node examples/sample-debate.js
```

## What is in the box

**The Gate.** Fourteen deterministic rules that block ad hominem, loaded language,
humor and ridicule, shouting, rhetorical questions, appeals to popularity, unnamed
authority, uncited empirical claims, overclaiming, undisciplined challenges, and
straw-manned steelmans. Rejections name the rule, quote the offending text, and
explain the fix. The lexicons are published, because a gate on a public record that
cannot be audited is not trustworthy. The rules constrain form only and contain no
reference to any position or conclusion.

**The scoring rubric.** `merit = E x R x S x Q`, over evidence tier, arbiter-assigned
relevance, survival under challenge, and declared confidence. Summed over each side's
canonical claims, converted to a margin, mapped to a band that includes an honest
`unresolved`.

**The protocol machine.** Phases and their prerequisites, merge-on-merit with strict
comparison, challenge resolution with demotion and repair, the steelman certification
gate, verdict issuance, and a bounded appeals process.

**An optional semantic screen.** The prompt, the rule definitions, and the response
parser for a model-based check on veiled attacks and sarcasm. Deliberately no network
code, no vendor endpoint, and no key handling: this package talks to nothing. Its
findings are advisory. Only the deterministic rules are normative.

## API

Pure functions and constants are importable directly. Writers come from
`createProtocol(env)`, which binds them to an injected clock and id generator.

```js
import { createProtocol, fixedClock, counterIds } from 'open-crucible-protocol';

// Production
const P = createProtocol();

// Tests: every id and timestamp reproducible, so a whole record can be asserted on
const T = createProtocol({ now: fixedClock(Date.UTC(2026, 0, 1)), newId: counterIds() });
```

| Group | Exports |
| --- | --- |
| Gate | `check`, `RULES`, `LEX`, `WORD_LIMITS`, `ACRONYM_WHITELIST`, `PICTOGRAPH_RE`, `wordCount`, `findPhrases`, `excerptAround` |
| Semantic screen | `SCREEN_SYSTEM`, `S_RULES`, `parseSemanticScreenResponse`, `buildScreenRequest`, `fieldsToScreenText` |
| Scoring | `evidenceBase`, `versionMerit`, `computeLedger`, `verdictBand`, `summarize`, `generateRationale` |
| Read-only protocol queries | `phasePrereq`, `canAppeal`, `canOpenThread`, `canProposeVersion`, `canChallenge` |
| Constants | `TIER_WEIGHT`, `TIER_LABEL`, `QUAL_WEIGHT`, `RELEVANCE_STEPS`, `PHASES`, `APPEAL_PHASE`, `CHALLENGE_GROUNDS`, `APPEAL_GROUNDS`, `VERDICT_BANDS`, `VERSION_STATUS`, `SCHEMA_VERSION` |
| Writers, from `createProtocol` | `newDebate`, `createThread`, `addVersion`, `addDefinition`, `addLog`, `mergeVersion`, `rejectVersion`, `fileChallenge`, `respondChallenge`, `resolveChallenge`, `submitSteelman`, `certifySteelman`, `returnSteelman`, `advancePhase`, `closeDebate`, `issueVerdict`, `fileAppeal`, `decideAppeal`, `concludeAppealReview` |
| Utility | `migrate`, `defaultEnv`, `fixedClock`, `counterIds`, `ERR`, `err` |

Writers mutate the debate document in place and return `null` on success or
`{code, message}` on refusal. They do not throw: a refused merge is an ordinary
protocol outcome, and callers usually want to display the reason. Assert on `code`,
never on `message`.

A debate document is plain JSON with no methods and no external references, so it
can be stored, transmitted, diffed, and replayed anywhere.

### One thing to know before building on this

`canOpenThread`, `canProposeVersion` and `canChallenge` are **advisory** in v1. The
writers do not call them, so a host that wants phase enforcement has to check them
before submitting. That is deliberate: enforcing phase rules inside the writers would
make it impossible to construct a completed debate record directly, which is exactly
what fixtures, importers, and migrations from other systems need to do. A `strict`
mode is planned.

## Testing

```bash
npm test
```

98 tests, `node:test`, no dependencies. They pin the things most likely to be
silently broken by a refactor: the exact band boundaries, the corroboration cap,
merge refusal on equal merit, relevance inheritance, demotion only against a
canonical version, every phase prerequisite, the appeal limit rules, and gate word
boundaries such as "liars" and "hackathon" not matching "liar" and "hack".

## Documentation

- [SPEC.md](SPEC.md) is the normative specification. It is written to be
  implementable in any language, and it includes a conformance checklist and an
  honest account of the protocol's limitations.
- [CONTRIBUTING.md](CONTRIBUTING.md) covers how to propose changes, including the
  standard a new lexicon term has to meet.

## What this is not

It is not a moderation system for general discussion, not a fact-checking service,
and not a way to settle questions of value. It adjudicates factual and logical claims
between two stated positions. Applied to a normative question it can only handle that
question's factual substrate, and an implementation should say so rather than let a
computed margin imply more than it establishes.

It also does not remove judgment from adjudication. Relevance weighting and tier
assignment are judgment calls that multiply into every score. What the protocol does
is make them explicit, recorded, assigned before totals are visible, and appealable.
Section 14 of the spec states the limitations plainly.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
