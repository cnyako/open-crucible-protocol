# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html). A change to a MUST in
SPEC.md is a major version.

## [1.0.0] - 2026-07-13

First public release. Extracted from a working application and generalized into a
standalone engine.

### Added

- **The Gate.** Rules G1 to G14 with published lexicons, word-boundary matching, and
  violation reports carrying the rule, the offending excerpt, and a fix.
- **Scoring.** `merit = E x R x S x Q`, the ledger, margins, and the four verdict
  bands with strict boundary comparison.
- **Protocol machine.** Phases and prerequisites, merge on merit, challenge
  resolution with demotion and repair, the steelman certification gate, verdict
  issuance, and appeals on grounds A1, A2 and A3.
- **`createProtocol(env)`** with injectable clock and id generator, plus `fixedClock`
  and `counterIds`, which make a complete debate record reproducible.
- **Semantic screen support**: prompt, rule definitions, and response parser, with no
  network code and no vendor coupling.
- **`migrate`** for reading documents written by older versions.
- **SPEC.md**, a normative specification with a conformance checklist.
- 98 tests under `node:test`, no dependencies.

### Notes on this release

- Error returns are `null` or `{code, message}`. Assert on `code`; `message` may be
  reworded in a minor release.
- `canOpenThread`, `canProposeVersion` and `canChallenge` are advisory: the writers
  do not call them. This lets a host construct a completed record directly, which
  fixtures and importers need. See Unreleased below.
- Log entries record protocol keys rather than display labels, so a record stays
  stable across relabeling and translation.

## [Unreleased]

Planned, in rough priority order:

- **`strict` mode**, an environment flag wiring the advisory permission predicates
  into the writers, so a host gets phase enforcement without implementing it. Held
  back from 1.0 because it needs a documented escape hatch for record construction.
- **Multi-arbiter decisions**: recording several arbiter judgments per decision and
  requiring agreement across arbiters who do not share a prior position, which is
  what SPEC.md section 4 recommends but the engine does not yet represent.
- **Recursion support**: first-class linking of a challenge to the sub-thread that
  resolves it, currently described in the spec but left to hosts.
- **Appeal windows**: optional time bounds on filing, with A3 exempt.

## 1.1.0

Hardening release, from an adversarial audit of 1.0. Every item below closes a way a
participant could win a debate they should lose. Nothing in the data model is removed and
1.0 documents load unchanged.

### Scoring

- **Claim budget.** A debate may declare `claimBudget`. Each side scores only its best N
  canonical claims; the rest stay in the ledger marked `scoring: false` with their merit
  intact. Totals are sums, so without a budget the winning strategy was volume.
- **Unsourced inference is cheaper.** `logical` drops from 3 to 2, `definitional` from 2
  to 1. A claim citing nothing no longer prices level with one citing a peer-reviewed study.
- **Effective tier.** A citation above T3 scores at T3 until an arbiter records
  verification with the new `verifyTier` writer. E is the dominant factor, so an unchecked
  tier was the largest lever available to a submitter.
- **Survival is capped at 1.3 and counts only opposing-side challenges.** Same-side
  dismissals no longer raise it.
- **The burden decides an unresolved ledger.** `burden` was recorded and ignored. An
  unresolved margin now resolves for the side that does not carry it, and the verdict
  records `byBurden`. The default is now `shared` rather than `A`, so the rule only applies
  where a burden was declared deliberately.

### Protocol

- `fileChallenge` refuses a challenge filed against the filer's own side, returning
  `CHALLENGE_SAME_SIDE`.
- `arbiterCertifySteelman` lets an arbiter certify a restatement a side will not, with a
  recorded reason. Certification was a veto on reaching a verdict.
- `verifyTier` records that an arbiter checked a citation, with a note, in the log.

### Fixes

- `npm test` works again on Node 22 and later. `node --test test/` now resolves the
  directory as a module.

## 1.1.1

Loose ends from a second adversarial pass, this time over the 1.1 release itself.

- The spec grew what the release notes had and the normative text did not: the Steelman
  shape, including arbiter certification over a recorded objection; `tierVerified` on the
  citation shape and `byBurden` on the verdict; verification defined as retrieval, not
  judgment of the citation string; verify-then-merge ordering; the burden rule stated to
  cover ties and empty ledgers; and a requirement that forced phase transitions be logged
  distinguishably from checked ones.
- `newDebate` clamps a claim budget below one to null. A budget of zero would score
  nobody and hand every debate to the burden default.
- `summarize`'s type declaration finally matches its 1.1 signature: it takes the burden
  and returns `byBurden`.
