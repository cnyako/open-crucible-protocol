/**
 * Published lexicons for the deterministic Gate rules.
 *
 * These lists are deliberately open to inspection. A gate that constrains what may
 * enter a public record has to be auditable, and a secret word list is not
 * auditable. Contributions that extend or correct these lists are welcome; see
 * CONTRIBUTING.md for the standard a term has to meet.
 *
 * Note what is not here: no list of positions, parties, ideologies, or conclusions.
 * The Gate constrains form only. It has no opinion about who is right.
 */

export const LEX = Object.freeze({
  /** G4. Terms that attack a person rather than a claim. */
  adHominem: Object.freeze([
    'liar', 'lying', 'lies', 'dishonest', 'disingenuous', 'idiot', 'idiotic',
    'stupid', 'fool', 'foolish', 'moron', 'moronic', 'ignorant', 'clown',
    'shill', 'corrupt', 'hypocrite', 'hypocritical', 'fraud', 'fraudulent',
    'quack', 'hack', 'incompetent', 'dumb', 'crazy', 'deluded', 'bad faith',
    'grifter', 'charlatan', 'crank', 'zealot'
  ]),

  /** G5. Outrage vocabulary. Intensity is not evidence. */
  loaded: Object.freeze([
    'outrageous', 'disgusting', 'ridiculous', 'absurd', 'insane', 'insanity',
    'horrifying', 'horrific', 'evil', 'wicked', 'shameful', 'pathetic',
    'nonsense', 'garbage', 'laughable', 'disgrace', 'disgraceful', 'appalling',
    'sickening', 'terrifying', 'madness', 'lunacy', 'disastrous', 'abomination',
    'travesty', 'scandalous'
  ]),

  /** G6. Humor and ridicule markers. Ridicule suppresses scrutiny rather than informing it. */
  humor: Object.freeze([
    'lol', 'lmao', 'rofl', 'haha', 'hehe', 'hilarious', 'joke', 'joking',
    'funny', 'mockery', 'mocking', 'yeah right', 'give me a break',
    'oh please', 'sure thing', 'nice try'
  ]),

  /** G9. Appeals to popularity or self-evidence. */
  popularity: Object.freeze([
    'everyone knows', 'everybody knows', 'everyone agrees', 'obviously',
    'undeniably', 'no one can deny', 'nobody can deny', 'common sense',
    'goes without saying', 'any reasonable person', 'as we all know'
  ]),

  /** G10. Authority invoked without a name attached. Permitted only with a citation. */
  unnamedAuthority: Object.freeze([
    'experts agree', 'experts say', 'scientists say', 'scientists agree',
    'studies show', 'studies have shown', 'research shows', 'research has shown',
    'it is well known', 'science says', 'the science is settled'
  ]),

  /** G12. Certainty language, permitted only when tier and qualifier support it. */
  overclaim: Object.freeze([
    'proves', 'proven beyond', 'definitively shows', 'definitively demonstrates',
    'beyond any doubt', 'beyond all doubt', '100%', 'guaranteed', 'irrefutable',
    'indisputable', 'incontrovertible'
  ]),

  /** G14. Distancing markers that turn a steelman back into a straw man. */
  steelmanDistance: Object.freeze([
    'so-called', 'supposedly', 'allegedly', 'naively', 'absurdly', 'wrongly',
    'falsely', 'pretends', 'purports', 'feigns'
  ])
});

/**
 * G7 exempts these from the all-caps check. Extend it for your own domain rather
 * than weakening the rule.
 */
export const ACRONYM_WHITELIST = new Set([
  'NASA', 'UNECE', 'IPCC', 'LCOE', 'OECD', 'IAEA', 'NOAA', 'USDA', 'USGS',
  'NATO', 'UNESCO', 'ASAP', 'IARPA', 'GRADE', 'HTML', 'NCBI', 'PNAS',
  'NAACL', 'IEEE', 'UNFCCC', 'NREL', 'ONS', 'MWH', 'TWH', 'KWH'
]);

/** G3 atomicity limits, in words, keyed by claim field name. */
export const WORD_LIMITS = Object.freeze({ assertion: 50, grounds: 150, warrant: 80 });

/**
 * G6 pictograph detection.
 *
 * Scoped to pictographic blocks and the variation selector. Arrows (U+2190 to
 * U+21FF) and mathematical operators (U+2200 to U+22FF) are deliberately excluded,
 * because a warrant may legitimately read "A implies B" using an arrow, and
 * rejecting that as an emoji violation would be a false positive on exactly the
 * kind of precise writing this protocol wants to encourage.
 */
export const PICTOGRAPH_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
