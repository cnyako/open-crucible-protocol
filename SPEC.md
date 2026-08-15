# The Crucible Protocol, version 1.1

A normative specification for implementers.

This document defines the protocol. It is written to be implementable in any
language without reference to the JavaScript package that accompanies it. Where the
reference implementation and this document disagree, this document is correct and
the implementation has a bug.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT and MAY are used in the sense of
RFC 2119.

## 1. Purpose and scope

The protocol adjudicates a disagreement between two positions on a single
proposition, and produces a verdict that is a function of evidence quality,
relevance, and survival under challenge. It is designed so that rhetorical skill has
no surface to act on: the qualities that decide traditional debates, which include
delivery, confidence, humor, and attacks on persons, are either excluded at
admission or absent from the scoring rule entirely.

The protocol adjudicates factual and logical claims. It does not adjudicate values.
A purely normative proposition can use the protocol only for its factual substrate,
and an implementation SHOULD make that boundary explicit to participants rather than
implying that a verdict settles a question of value.

## 2. Design commitments

These commitments explain why the rules take the shape they do. An implementation
that abandons one of them is not implementing this protocol.

1. **Asynchronous and written.** No phase has a time limit. Timed formats make
   assertion cheaper than refutation, which rewards volume over accuracy.
2. **Identity-blind evaluation, attributed record.** Merge and challenge decisions
   MUST cite content and rubric only. Authorship MUST still be recorded permanently.
3. **Admission before the record.** Inadmissible material never enters the debate,
   so no adjudicator has to discount it later.
4. **Pre-committed scoring.** The rubric, tiers, and bands are fixed and public
   before any argument is submitted, and MUST NOT be changed inside a live debate.
5. **Open contribution, declared advocacy.** Anyone MAY contribute to either side.
   Every contribution MUST declare the side it advocates for.
6. **Merge on merit.** The canonical case holds the strongest available version of
   each claim, whoever wrote it.
7. **Falsifiable verdicts.** A concluded debate MUST remain reopenable on narrow
   enumerated grounds.

## 3. Data model

A debate is a single document. It MUST be serializable as JSON and MUST NOT depend
on state held elsewhere.

### 3.1 Debate

| Field | Type | Notes |
| --- | --- | --- |
| `schemaVersion` | integer | Version of this document format |
| `id` | string | Unique |
| `resolution` | string | One decidable proposition |
| `positions` | `{A: string, B: string}` | Exactly two |
| `burden` | `"A" \| "B" \| "shared"` | Declared at framing. Decides an unresolved ledger, section 9 |
| `claimBudget` | positive integer or null | Claims each side may score, section 9 |
| `definitions` | array | Agreed meanings of key terms |
| `phase` | phase key | Section 6 |
| `threads` | array of Thread | Claim threads for both sides |
| `challenges` | array of Challenge | |
| `steelmans` | `{A: Steelman, B: Steelman}` | Keyed by the side being restated |
| `verdicts` | array of Verdict | Append only |
| `appeals` | array of Appeal | |
| `appealTargets` | array of thread id | Threads reopened by the active appeal |
| `activeAppealId` | string or null | |
| `log` | array of LogEntry | Append only |

### 3.2 Thread

A thread is one atomic point. It holds an ordered version history and at most one
canonical version.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | |
| `side` | `"A" \| "B"` | The case this thread belongs to |
| `title` | string | |
| `versions` | array of Version | Append only, ordered |
| `canonicalId` | version id or null | Null means the thread scores nothing |

### 3.3 Version

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `threadId` | string | |
| `num` | integer | 1-based position in the thread |
| `parentId` | version id or null | The version this one descends from |
| `author` | string | Recorded permanently |
| `side` | `"A" \| "B"` | Declared advocacy, see G1 |
| `type` | `empirical \| logical \| definitional` | |
| `assertion` | string | One atomic statement |
| `grounds` | string | Evidence or premises offered |
| `warrant` | string | The inference license connecting grounds to assertion |
| `evidence` | array of `{source, url, tier}` | Tier from section 5 |
| `qualifier` | `certain \| probable \| plausible` | Required |
| `status` | see 3.4 | |
| `relevance` | 0.25, 0.5, 0.75, 1.0, or null | Assigned by an arbiter |
| `mergeRationale` | string | Written reason for the merge or rejection decision |

The assertion, grounds and warrant fields implement the Toulmin structure. Requiring
the warrant to be stated is load bearing: most real disagreement hides in an
unstated inference rule rather than in the facts.

### 3.4 Version status

| Status | Meaning |
| --- | --- |
| `candidate` | Passed the Gate, awaiting a merge decision |
| `merged` | Canonical. The only status that scores |
| `superseded` | Replaced by a stronger version of the same claim |
| `demoted` | Removed from the main branch by an upheld challenge |
| `rejected` | Declined at merge review |

### 3.5 Challenge

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `threadId`, `versionId` | string | Targets a specific version |
| `ground` | one of four keys | Section 7 |
| `text` | string | Passes the Gate like any input |
| `evidence` | array | Required for two grounds, see G11 |
| `author`, `side` | string | |
| `response` | `{text, author, side, ts}` or null | |
| `resolution` | `upheld \| dismissed` or null | |
| `rationale` | string | Written reason, required |
| `appealId` | appeal id or null | Set when filed during an appeal review |

### 3.6 Verdict

Verdicts are append only. Issuing a new verdict MUST NOT modify an earlier one.

| Field | Type |
| --- | --- |
| `n` | integer, 1-based |
| `winner` | `"A" \| "B"` or null |
| `totals` | `{A: number, B: number}` |
| `margin` | number |
| `band` | `{key, label}` |
| `rationale` | string |
| `ledger` | frozen array of ledger rows |
| `viaAppealId` | appeal id or null |

## 4. Roles

**Contributor.** Anyone. MUST declare a side per contribution. MAY open threads,
propose versions, file challenges against the opposing side, respond to challenges
for their own side, write the steelman of the opposing case, certify the steelman of
their own case, and file appeals.

**Arbiter.** Neutral. MAY decide merges, resolve challenges, assign relevance
weights, advance phases, issue verdicts, and decide appeals. MUST NOT contribute
content to either side. Every arbiter decision MUST carry a written rationale and
MUST be recorded.

A production deployment SHOULD select arbiters by demonstrated calibration rather
than by credential, and SHOULD require agreement across arbiters who do not share a
prior position, on the model of bridging-based ranking. A single arbiter is a single
point of failure, which is why arbiter error is itself an appealable ground (A2).

**Observer.** Read access to the entire record.

## 5. Evidence tiers

| Tier | Weight | Description |
| --- | --- | --- |
| T1 | 5 | Systematic review, meta-analysis, or findings replicated across independent teams |
| T2 | 4 | Randomized controlled trial, large well-designed cohort, or official statistics from a primary statistical agency |
| T3 | 3 | Single peer-reviewed study, or a primary institutional or government report |
| T4 | 2 | Named expert analysis, journalism from an outlet with a corrections policy, or industry data |
| T5 | 1 | Other documented, publicly checkable source |

Tier assignment is part of a submission and is itself challengeable on the
evidence-validity ground. An implementation MUST NOT treat a tier as settled merely
because the submitter asserted it.

Because E is the dominant factor in the rubric, an unchecked tier is the largest lever a
participant can pull, and challenges are too scarce to be the only check: in practice most
citations are never challenged by anyone. A citation therefore scores at no more than T3
until an arbiter records verification by setting `tierVerified` on it, which SHOULD happen
at merge review, where the arbiter is already writing a rationale.

## 6. Phases

Phases advance in order. An arbiter MUST NOT advance a phase whose prerequisites are
unmet.

| Phase | Activity | Prerequisite to advance |
| --- | --- | --- |
| `framing` | Resolution, positions, definitions, burden | Resolution and both positions set |
| `construction` | Open contribution: threads, versions, merges | Each side has at least one canonical version, and no candidate awaits a decision |
| `challenge` | Challenges, responses, resolutions, repairs | No unresolved challenge, and no candidate awaits a decision |
| `steelman` | Each side restates the other, the restated side certifies | Both steelmans certified or arbiter-certified |
| `adjudication` | Relevance weights assigned | Every canonical version has a relevance weight |
| `verdict` | Verdict issued from the ledger | A verdict exists |
| `closed` | Record final | Terminal. Reopens only via an admitted appeal |

`appeal-review` is a phase but is not a member of the ordered sequence. It is entered
only by admitting an appeal and exits only by concluding one. An implementation MUST
refuse an ordinary phase advance from `appeal-review`.

Relevance weights MUST be assigned before totals are revealed to the arbiter. This
is the same pre-commitment principle that registered reports apply to publication.

## 7. Challenges

A challenge MUST be filed against the opposing side. An implementation MUST refuse a
challenge whose declared side equals the side of the targeted thread, and MUST NOT count
a same-side dismissal toward survival. Without both, the survival factor is farmable by
two cooperating participants on opposite declared sides.

A challenge MUST cite exactly one of these grounds. No other objection is admissible.

| Ground | Claim being made | Citation required |
| --- | --- | --- |
| `evidence-validity` | The cited source does not say this, is unreliable, is misquoted, or has been retracted | Yes |
| `warrant-failure` | The inference from grounds to assertion does not hold | No |
| `relevance` | Even if true, the claim does not bear on the resolution | No |
| `counter-evidence` | Evidence of equal or higher tier contradicts the assertion | Yes |

**Upholding** a challenge sets the targeted version to `demoted` and sets the
thread's `canonicalId` to null, but only when the targeted version is currently
canonical. The thread then reopens for repaired versions from either side.

Refutation is a failing test, not an elimination. This is deliberate: a protocol in
which a refuted claim simply disappears rewards never making a checkable claim.

**Dismissing** a challenge leaves the version canonical and increments its survival
factor.

**Recursion.** When a response disputes one specific sub-point, an arbiter MAY
require that sub-point to be opened as its own thread and resolve the challenge on
that thread's outcome. This is the countermeasure to arguments whose flaw is spread
thinly enough that no single rebuttal localizes it.

## 8. The Gate

Every input MUST pass the Gate before entering the record. A rejected submission MUST
be returned with the violated rule, the offending excerpt, and a description of how
to fix it.

The Gate constrains form only. It MUST NOT reference positions, parties, ideologies
or conclusions, and an implementation MUST NOT extend it to do so.

| Rule | Name | Enforces |
| --- | --- | --- |
| G1 | Side declaration | A contributor handle and a declared side. Arbiters are exempt from the side requirement |
| G2 | Structural completeness | Claims state assertion, grounds, warrant, type, and qualifier |
| G3 | Atomicity | Assertion at most 50 words, grounds 150, warrant 80 |
| G4 | No person-directed language | No ad hominem, no second-person accusation, no characterization of opponents |
| G5 | No loaded or emotive language | No outrage vocabulary |
| G6 | No humor, ridicule, or sarcasm | No jokes, mockery, or pictographs |
| G7 | Formal register | No all-caps shouting, no exclamation marks |
| G8 | No rhetorical questions | No question marks in argumentative fields |
| G9 | No appeal to popularity or obviousness | No claims from what everyone knows |
| G10 | No unnamed authority | No invoking studies or experts without a citation |
| G11 | Citation required | Empirical claims, two challenge grounds, and appeal grounds A1 and A3 |
| G12 | No overclaiming | Certainty language requires a `certain` qualifier and, for empirical claims, tier weight 5 |
| G13 | Challenge discipline | Exactly one enumerated ground |
| G14 | Steelman fidelity | No distancing or derision markers in a restatement |

Implementation requirements:

- Word boundary matching MUST be used for lexicon terms, so that "liar" does not
  match inside "liars" and "hack" does not match inside "hackathon".
- Per-field rules MUST skip empty fields, so an empty required field is reported
  once by G2 rather than also by length or content rules.
- The lexicons MUST be published. A gate that restricts what may enter a public
  record cannot be audited if its word lists are secret.

### 8.1 Optional semantic screen

An implementation MAY add a semantic screen for violations that pattern matching
cannot detect: veiled attacks, sarcasm carried by structure, loaded framing in
neutral vocabulary, misrepresented citations, and assertion by insinuation.

Findings from this screen are ADVISORY. Only the deterministic rules are normative.
An implementation that makes an opaque model's judgment binding on admission has
replaced an auditable gate with an unauditable one.

## 9. Scoring

For each canonical version:

```
E = evidence base
    empirical:     max effective tier weight among citations
                   + 0.5 per additional citation, capped at +1.0
                   0 when there are no citations
    logical:       2
    definitional:  1

    A citation's effective tier weight is its claimed weight when an arbiter has
    recorded verification of the source, and min(claimed, T3) otherwise.

R = relevance      0.25 | 0.5 | 0.75 | 1.0, arbiter-assigned
                   an unassigned relevance is treated as 1.0 for merge comparison

S = survival       min(1.3, 1 + 0.1 x (opposing-side challenges dismissed
                   against this version))

Q = qualifier      certain 1.0 | probable 0.9 | plausible 0.75

merit = E x R x S x Q
```

A side's total is the sum of merit over its canonical versions, subject to the claim
budget below. Versions that are not canonical, including demoted ones, do not appear in
the ledger and contribute nothing.

**Claim budget.** A debate MAY declare `claimBudget`, a positive integer, at framing. It
MUST be identical for both sides. When set, each side scores only its `claimBudget`
highest-merit canonical versions; the remainder MUST appear in the ledger marked as not
scoring, with their merit intact, and MUST NOT be added to the total. When unset, every
canonical version scores, which is the version 1.0 rule.

A budget exists because totals are sums. Without one, the winning strategy is volume:
eighteen thin claims outscore three strong ones, and padding the leading side widens the
margin band as well. That is the same failure the design commitments attribute to timed
formats, arriving through the scoring rule instead of the clock. An implementation
SHOULD set a budget.

```
margin = (higher total - lower total) / higher total
```

| Margin | Band |
| --- | --- |
| less than 0.10 | `unresolved`, see the burden rule below |
| 0.10 to less than 0.25 | `balance`, winner on balance of evidence |
| 0.25 to less than 0.50 | `clear` |
| 0.50 and above | `decisive` |

Comparisons are strictly less than each threshold, so a margin of exactly 0.10 is
`balance` and exactly 0.25 is `clear`. An empty ledger yields a margin of 0 and is
unresolved.

**The burden rule.** `burden`, declared at framing, decides an unresolved ledger. When it
is `A` or `B`, an unresolved margin resolves for the other side, and the verdict MUST
record `byBurden: true`. When it is `shared`, an unresolved margin declares no winner, as
in version 1.0. A side that must prove a proposition and fails to separate itself from
its opponent has not proved it, and recording a burden that changes nothing is worse than
not recording one.

An implementation using binary floating point MUST round the margin before comparing
it against a threshold, to at least nine decimal places. Margins are computed from
sums of products of decimal weights, so a ledger that sits mathematically on a
boundary generally does not sit on it in binary: totals of 2.70 against 3.60 are a
margin of exactly 0.25, but the naive computation yields 0.24999999999999997, which
would award the band below for a reason no participant could observe or contest.

The corroboration cap and the qualifier weights are the two places where the rubric
expresses a judgment rather than a measurement. The cap prevents a long bibliography
from outweighing the quality of its best source. The qualifier weights make honest
hedging cheaper than the demotion risk that overclaiming carries under G12.

## 10. Merging

A candidate MUST merge only when its merit strictly exceeds the incumbent's. Equal
merit MUST be refused: "merge on merit" has to mean something a challenger has to
clear.

On merge, the incumbent becomes `superseded`. A candidate with no assigned relevance
MUST inherit the incumbent's, so that improving a claim does not silently discard a
weight an arbiter already considered.

Every merge and rejection MUST carry a written rationale that cites content and
rubric only.

## 11. Verdict

A verdict freezes the ledger at the moment of issue and MUST record the winner,
both totals, the margin, the band, a written rationale, and the frozen ledger rows.

The rationale MUST be derivable from the ledger alone. A verdict that cannot be
recomputed by a reader from published numbers is an opinion with a number attached.

## 12. Appeals

A closed debate reopens only on these grounds:

| Ground | Condition |
| --- | --- |
| A1 | Newly discovered evidence that did not exist or could not reasonably have been found during the debate, at a tier and relevance capable of changing the band |
| A2 | Demonstrable misapplication of this specification, including scoring error, a bypassed gate, or an unresolved challenge at verdict |
| A3 | A cited source load bearing to the ledger has been retracted or materially corrected |

Procedure:

1. An appeal MUST name its ground, the specific threads affected, and, for A1 and
   A3, the citations. It MUST pass the Gate.
2. One appeal per side. A denied appeal MUST NOT consume the allowance, since denial
   means the petition failed to state a ground, not that the side has had its hearing.
3. An implementation SHOULD impose a filing window, with A3 exempt.
4. The deciding arbiter SHOULD be a fresh panel. The test is whether the appeal,
   taken at face value, could plausibly change the verdict band.
5. An admitted appeal reopens only the named threads, for one bounded cycle.
6. Concluding recomputes the ledger and issues a revised verdict. Both verdicts stay
   on the record, connected by the appeal.

## 13. Conformance

An implementation conforms if:

1. It rejects every submission that violates G1 to G14, with the rule identified.
2. It computes merit, totals, margin and band exactly as section 9 defines, including
   the corroboration cap, the survival cap, the effective tier rule, the claim budget and
   the strict band boundaries.
2a. It refuses a challenge filed against the filer's own side, and excludes same-side
   dismissals from survival.
2b. It resolves an unresolved ledger by the declared burden, and records `byBurden`.
3. It refuses a merge whose merit does not strictly exceed the incumbent's.
4. An upheld challenge demotes the targeted version only when that version is
   canonical, and empties the thread.
5. It refuses to advance a phase whose prerequisites are unmet, and refuses an
   ordinary advance from `appeal-review`.
6. It enforces one appeal per side, excluding denied appeals, and scopes a reopening
   to the named threads.
7. Verdicts are append only and every arbiter decision carries a recorded rationale.
8. The full record, including rejected and demoted material, is retained.

## 14. Known limitations

Stated plainly, because a protocol that claims to eliminate judgment is lying about
where the judgment went.

- **Relevance weighting is a judgment call.** It is arbiter-assigned, and it
  multiplies every claim's score. The protocol makes it explicit, recorded, assigned
  before totals are visible, and appealable, which is better than implicit. It does
  not make it objective.
- **Tier assignment is a judgment call.** Same treatment: explicit and challengeable.
- **The rubric weights are defensible, not derived.** No experiment fixed the
  corroboration cap at +1.0 or the survival increment at 0.1. They are published so
  that disagreement about them is possible.
- **Framing is load bearing.** A badly framed resolution biases everything after it.
  The framing phase deserves the same adversarial attention as construction.
- **Structure has a cost.** Every argument-mapping system in the last fifty years has
  found that contributors resist formalization. An implementation SHOULD reduce that
  cost with scaffolding and drafting assistance rather than pretending it is absent.
- **Values are out of scope.** See section 1.

## 15. References

The protocol assembles mechanisms established elsewhere. These are the principal
sources for its parts.

- Toulmin, S. (1958). *The Uses of Argument.* Claim, grounds, warrant, backing,
  qualifier, rebuttal.
- Walton, D., Reed, C., and Macagno, F. (2008). *Argumentation Schemes.* Cambridge
  University Press. Critical questions as a rebuttal rulebook.
- Guyatt, G. et al. (2008). "GRADE: an emerging consensus on rating quality of
  evidence." *BMJ* 336. The evidence tier ladder.
- Federal Rules of Evidence 403, and *Daubert v. Merrell Dow Pharmaceuticals*,
  509 U.S. 579 (1993). Admissibility gating before the record.
- Kahneman, D., and Clark, C., Tetlock, P. et al. (2022). Adversarial collaboration.
  Pre-commitment to what evidence would count.
- Chambers, C. (2013). "Registered Reports." *Cortex* 49. Pre-commitment applied to
  publication.
- Caplan, B. (2011). "The Ideological Turing Test." The steelman certification gate.
- Irving, G., Christiano, P., and Amodei, D. (2018). "AI Safety via Debate."
  arXiv:1805.00899. Recursion to the disputed step. See also Barnes and Christiano
  (2020) on obfuscated arguments, the failure mode that recursion answers.
- Cooke, R. (1991). *Experts in Uncertainty.* Weighting judgment by measured
  calibration rather than credential.
- Wojcik, S. et al. (2022). "Birdwatch: Crowd Wisdom and Bridging Algorithms."
  arXiv:2210.15723. Agreement across prior disagreement as a publication threshold.
- Barnes, R. M. et al. (2018). "The effect of ad hominem attacks on the evaluation of
  claims promoted by scientists." *PLOS ONE* 13(1). Why G4 exists.
- Mercier, H., and Sperber, D. (2011). "Why Do Humans Reason?" *Behavioral and Brain
  Sciences* 34. Why production is partisan and evaluation is structured.
