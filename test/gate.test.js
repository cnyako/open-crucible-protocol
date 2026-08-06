import test from 'node:test';
import assert from 'node:assert/strict';
import { check, RULES, findPhrases, wordCount } from '../src/index.js';
import { claimFields, claimCtx, ruleIds } from './helpers.js';

/** Built from a char code so this file itself satisfies the no-em-dash policy. */
const EM_DASH = String.fromCharCode(0x2014);

/** Runs one argumentative field through the Gate. */
function one(text, ctx = {}) {
  return check(
    [{ name: 'grounds', label: 'Grounds', text, argumentative: true, required: true }],
    claimCtx(ctx)
  );
}
const hits = (text, rule, ctx) => one(text, ctx).filter(v => v.rule === rule);

test('every rule carries an id, a name, and a description for rendering', () => {
  assert.equal(RULES.length, 14);
  for (const r of RULES) {
    assert.match(r.id, /^G\d+$/);
    assert.ok(r.name.length > 0);
    assert.ok(r.description.length > 0, `${r.id} needs a description`);
    assert.ok(!r.description.includes(EM_DASH), `${r.id} description carries no em dash`);
  }
});

test('a compliant claim passes clean', () => {
  const v = check(claimFields({
    assertion: 'Eliminating commutes returns two or more usable hours per week.',
    grounds: 'The cited survey reports 72 minutes of daily commute time saved.',
    warrant: 'If saved time is partly reallocated to work then productive hours rise.'
  }), claimCtx());
  assert.deepEqual(v, []);
});

test('G1: handle and side are required, and arbiters are exempt from side', () => {
  assert.ok(one('text', { author: '' }).some(v => v.rule === 'G1'));
  assert.ok(one('text', { side: null }).some(v => v.rule === 'G1'));
  assert.equal(one('text', { side: null, role: 'arbiter' }).filter(v => v.rule === 'G1').length, 0);
});

test('G2: required fields and the qualifier, for claims only', () => {
  const missing = check(claimFields({ assertion: '', grounds: 'g', warrant: 'w' }), claimCtx());
  assert.ok(missing.some(v => v.rule === 'G2' && v.field === 'Assertion'));
  assert.ok(missing.every(v => v.rule !== 'G3'), 'an empty field is reported once, by G2');

  assert.ok(one('text', { qualifier: '' }).some(v => v.rule === 'G2'));
  assert.equal(one('text', { kind: 'challenge', qualifier: '' }).filter(v => v.rule === 'G2').length, 0);
});

test('G3: word limits are boundary-exact and only apply to named fields', () => {
  const words = n => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  const assertionOf = n => check(
    [{ name: 'assertion', label: 'Assertion', text: words(n), argumentative: true, required: true }],
    claimCtx()
  ).filter(v => v.rule === 'G3');

  assert.equal(assertionOf(50).length, 0);
  assert.equal(assertionOf(51).length, 1);
  assert.equal(wordCount(words(51)), 51);

  const unnamed = check(
    [{ name: 'freeform', label: 'Notes', text: words(500), argumentative: false }],
    claimCtx()
  );
  assert.equal(unnamed.filter(v => v.rule === 'G3').length, 0);
});

test('G4: person-directed language, including the second person and opponent references', () => {
  assert.equal(hits('The author is a liar about the data.', 'G4').length, 1);
  assert.ok(hits('You are misreading the table.', 'G4').length >= 1);
  assert.ok(hits('The opponents ignore the fuel cycle.', 'G4').length >= 1);
});

test('G4: word boundaries prevent false positives inside longer words', () => {
  assert.equal(hits('The liars paradox is a classic puzzle.', 'G4').length, 0);
  assert.equal(hits('The hackathon produced three prototypes.', 'G4').length, 0);
  assert.equal(findPhrases('hackathon', ['hack']).length, 0);
  assert.equal(findPhrases('a hack job', ['hack']).length, 1);
});

test('G5 and G9: loaded vocabulary and appeals to obviousness', () => {
  assert.equal(hits('This is an absurd reading of the statute.', 'G5').length, 1);
  assert.equal(hits('Everyone knows the figure is too low.', 'G9').length, 1);
  assert.equal(hits('Obviously the trend continues.', 'G9').length, 1);
});

test('G6: humor markers and pictographs, but arrows and operators are permitted', () => {
  assert.equal(hits('That claim is hilarious given the record.', 'G6').length, 1);
  assert.equal(hits('The measurement stands \u{1F600} as reported.', 'G6').length, 1);
  assert.equal(hits('The chain A → B → C holds under the stated conditions.', 'G6').length, 0);
  assert.equal(hits('Where x ≥ 3 the relation holds.', 'G6').length, 0);
});

test('G7: exclamation marks, all-caps shouting, and the acronym whitelist', () => {
  assert.equal(hits('The figure is wrong!', 'G7').length, 1);
  assert.equal(hits('This is COMPLETELY unsupported by the data.', 'G7').length, 1);
  assert.equal(hits('The NASA dataset covers the period.', 'G7').length, 0);
});

test('G7: only the first all-caps hit is reported', () => {
  const v = hits('The FIRST and SECOND and THIRD tables disagree.', 'G7');
  assert.equal(v.length, 1);
});

test('G8: question marks only matter in argumentative fields', () => {
  assert.equal(hits('Why would anyone accept that reading?', 'G8').length, 1);
  const nonArg = check(
    [{ name: 'note', label: 'Note', text: 'Is this right?', argumentative: false }],
    claimCtx()
  );
  assert.equal(nonArg.filter(v => v.rule === 'G8').length, 0);
});

test('G10: unnamed authority is permitted only with a citation attached', () => {
  assert.equal(hits('Studies show the effect persists.', 'G10', { evidenceCount: 0 }).length, 1);
  assert.equal(hits('Studies show the effect persists.', 'G10', { evidenceCount: 1 }).length, 0);
});

test('G11: citation requirements per submission kind', () => {
  assert.ok(one('text', { type: 'empirical', evidenceCount: 0 }).some(v => v.rule === 'G11'));
  assert.equal(one('text', { type: 'logical', evidenceCount: 0 }).filter(v => v.rule === 'G11').length, 0);

  const chal = g => check(
    [{ name: 'text', label: 'Argument', text: 'The source does not support this.', argumentative: true }],
    claimCtx({ kind: 'challenge', ground: g, evidenceCount: 0, qualifier: undefined })
  ).filter(v => v.rule === 'G11');
  assert.equal(chal('evidence-validity').length, 1);
  assert.equal(chal('counter-evidence').length, 1);
  assert.equal(chal('warrant-failure').length, 0);

  const appeal = g => check(
    [{ name: 'just', label: 'Justification', text: 'A new source exists.', argumentative: true }],
    claimCtx({ kind: 'appeal', ground: g, evidenceCount: 0, qualifier: undefined })
  ).filter(v => v.rule === 'G11');
  assert.equal(appeal('A1').length, 1);
  assert.equal(appeal('A3').length, 1);
  assert.equal(appeal('A2').length, 0);
});

test('G12: certainty language needs both a certain qualifier and a top tier', () => {
  const overclaim = 'The dataset proves the mechanism.';
  assert.equal(hits(overclaim, 'G12', { qualifier: 'probable', maxTierWeight: 5 }).length, 1);
  assert.equal(hits(overclaim, 'G12', { qualifier: 'certain', maxTierWeight: 4 }).length, 1,
    'T2 evidence does not license certainty');
  assert.equal(hits(overclaim, 'G12', { qualifier: 'certain', maxTierWeight: 5 }).length, 0);
  assert.equal(hits(overclaim, 'G12', { qualifier: 'certain', type: 'logical', maxTierWeight: 0 }).length, 0,
    'non-empirical claims are exempt from the tier condition');
});

test('G13: challenges need exactly one enumerated ground', () => {
  const withGround = g => check(
    [{ name: 'text', label: 'Argument', text: 'The inference fails.', argumentative: true }],
    claimCtx({ kind: 'challenge', ground: g, qualifier: undefined })
  ).filter(v => v.rule === 'G13');
  assert.equal(withGround('warrant-failure').length, 0);
  assert.equal(withGround('vibes').length, 1);
  assert.equal(withGround(undefined).length, 1);
});

test('G14: distancing markers, in steelmans only', () => {
  const sm = text => check(
    [{ name: 'steelman', label: 'Steelman', text, argumentative: false }],
    claimCtx({ kind: 'steelman', qualifier: undefined })
  ).filter(v => v.rule === 'G14');
  assert.equal(sm('The negative case supposedly rests on cost.').length, 1);
  assert.equal(sm('The negative case rests on cost per unit of abatement.').length, 0);

  const notSteelman = hits('The claim supposedly rests on cost.', 'G14');
  assert.equal(notSteelman.length, 0);
});

test('a submission breaking many rules reports each of them with a fix', () => {
  const v = check(claimFields({
    assertion: 'Everyone knows this is obviously an absurd position!',
    grounds: 'Studies show the author is a liar. LOL, why even argue?',
    warrant: 'It proves the point COMPLETELY.'
  }), claimCtx({ evidenceCount: 0, maxTierWeight: 0 }));

  assert.deepEqual(ruleIds(v), ['G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'].sort());
  for (const violation of v) {
    assert.ok(violation.fix && violation.fix.length > 0, `${violation.rule} explains how to fix it`);
    assert.ok(violation.message && violation.message.length > 0);
  }
});

test('check tolerates missing arguments rather than throwing', () => {
  assert.doesNotThrow(() => check(undefined, undefined));
  assert.ok(Array.isArray(check(undefined, undefined)));
});
