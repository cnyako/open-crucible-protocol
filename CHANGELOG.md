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
