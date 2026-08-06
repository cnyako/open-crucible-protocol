import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSemanticScreenResponse, buildScreenRequest, fieldsToScreenText,
  SCREEN_SYSTEM, S_RULES
} from '../src/index.js';

test('a clean pass parses to no violations', () => {
  const r = parseSemanticScreenResponse('{"pass": true, "violations": []}');
  assert.equal(r.pass, true);
  assert.deepEqual(r.violations, []);
});

test('JSON wrapped in prose is extracted', () => {
  const raw = 'Here is my assessment:\n\n{"pass": false, "violations": [{"rule": "S2-sarcasm", "excerpt": "sure it does"}]}\n\nHope that helps.';
  const r = parseSemanticScreenResponse(raw);
  assert.equal(r.pass, false);
  assert.equal(r.violations.length, 1);
  assert.equal(r.violations[0].rule, 'S2-sarcasm');
});

test('unparseable output is skipped rather than thrown', () => {
  for (const raw of ['', 'no json here', '{not valid json}', null, undefined]) {
    const r = parseSemanticScreenResponse(raw);
    assert.equal(r.skipped, true, `skipped for ${JSON.stringify(raw)}`);
    assert.ok(r.error);
  }
});

test('a missing violations array defaults to empty', () => {
  const r = parseSemanticScreenResponse('{"pass": false}');
  assert.equal(r.pass, false);
  assert.deepEqual(r.violations, []);
});

test('pass is strictly boolean true, never merely truthy', () => {
  assert.equal(parseSemanticScreenResponse('{"pass": "yes", "violations": []}').pass, false);
  assert.equal(parseSemanticScreenResponse('{"pass": 1, "violations": []}').pass, false);
});

test('a JSON array alone is not accepted as a screen result', () => {
  assert.equal(parseSemanticScreenResponse('[1,2,3]').skipped, true);
});

test('the request builder carries the protocol prompt and no transport detail', () => {
  const req = buildScreenRequest('Grounds: the cited source reports the figure.');
  assert.equal(req.system, SCREEN_SYSTEM);
  assert.equal(req.messages[0].role, 'user');
  assert.match(req.messages[0].content, /cited source/);
  assert.equal(JSON.stringify(req).includes('api.anthropic.com'), false);
  assert.equal(JSON.stringify(req).includes('api_key'), false);
});

test('the screen prompt names every S rule it can return', () => {
  for (const id of Object.keys(S_RULES)) {
    assert.ok(SCREEN_SYSTEM.includes(id), `${id} appears in the prompt`);
  }
});

test('fields render into a single labelled block', () => {
  const text = fieldsToScreenText([
    { label: 'Assertion', text: 'One atomic point.' },
    { label: 'Warrant', text: 'The inference license.' }
  ]);
  assert.equal(text, 'Assertion: One atomic point.\n\nWarrant: The inference license.');
  assert.equal(fieldsToScreenText(undefined), '');
});
