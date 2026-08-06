# Contributing

Thanks for considering a contribution. This project has an unusual property: the code
enforces rules about public argument, so changes to it are changes to what people are
allowed to say inside a debate. That calls for a higher bar than an ordinary utility
library, particularly around the Gate.

## Ground rules

1. **No runtime dependencies.** Ever. This package must remain installable, auditable,
   and runnable in a browser without a build step.
2. **No network calls.** The engine talks to nothing. If a feature needs I/O, the
   engine ships the pure part and the host owns the transport. The semantic screen is
   the model: prompt and parser here, fetch in the host.
3. **The Gate constrains form, never position.** A rule or lexicon term that could
   only be triggered by one side of some real debate does not belong here. If you
   cannot state a rule without naming a topic, it is not a Gate rule.
4. **Every behavior change ships a test.** `npm test` must pass on Node 20 and 22.
5. **Prose in this repository does not use em dashes.** Use a comma, a colon, or a
   new sentence. This applies to documentation, comments, and user-visible strings.

## Getting started

```bash
git clone https://github.com/cnyako/open-crucible-protocol.git
cd open-crucible-protocol
npm test
node examples/sample-debate.js
```

There is nothing to install and nothing to build.

## Proposing a lexicon term

Adding a word to `src/gate/lexicons.js` means that word can block a contribution, so
a proposal has to clear four tests:

1. **Form, not content.** The term marks how something is said, not what is claimed.
2. **Symmetric.** It is as likely to be triggered by one side of a disagreement as
   the other.
3. **No common innocent sense.** Check that word-boundary matching does not create
   false positives. "hack" nearly failed this and is why the boundary tests exist.
4. **Fixable.** A contributor who trips it can rewrite and say the same substantive
   thing.

Include a test in `test/gate.test.js` with both a trigger case and a near-miss.

## Proposing a rubric change

Weights in `src/constants.js` and the formula in `src/scoring.js` are the protocol's
scoring rule. Changing one changes the outcome of every debate run under it, so open
an issue before writing code, and state:

- which mechanism the current value gets wrong, with a worked example
- what the new value does to the sample debate in `examples/`
- why the change cannot be achieved through relevance weighting instead

Section 14 of SPEC.md is candid that these weights are defensible rather than
derived. Arguments that they should be different are welcome. Arguments that they
should be secret or dynamic are not.

## Changes to the spec

SPEC.md is normative. When behavior and spec disagree, the spec is right and the code
has a bug. A pull request that changes behavior must change SPEC.md in the same
commit, and a change to a MUST is a major version.

## Reporting a conformance bug

Conformance bugs are the highest-value reports. If you find a case where the engine
disagrees with section 13 of the spec, open an issue with a failing test. Especially
valuable:

- a scoring path that produces a different merit than the formula
- a gate rule that can be evaded by rephrasing without changing meaning
- a state the protocol machine can reach that the spec does not describe
- an input that makes a writer throw instead of returning an error

## Security

The engine handles no credentials and makes no network calls, so its attack surface
is input handling. If you find an input that causes unbounded computation or a crash
in a host embedding this library, please report it privately through GitHub's
security advisory form rather than opening a public issue.

## Code style

Match what is there: ES modules, two-space indent, single quotes, semicolons, and
comments that explain why a rule exists rather than restating what the line does. The
existing comments are the model. A reader should be able to learn the protocol's
reasoning from the source.

## License

Contributions are accepted under Apache-2.0, the license of this project.
