/**
 * The optional semantic screen.
 *
 * The deterministic rules in rules.js catch stated violations. They cannot catch
 * the veiled version: an attack phrased as concern, sarcasm carried entirely by
 * structure, or a citation characterized in a way its own title makes implausible.
 * A language model can, and this module holds the protocol side of that screen.
 *
 * What is deliberately not here: any network call, any vendor endpoint, any model
 * identifier, and any API key handling. This package has no runtime dependencies
 * and talks to nothing. Host applications own the transport; the prompt, the rule
 * definitions, and the response parsing live here so they can be inspected,
 * versioned, and tested without a network.
 *
 * Findings from this screen are advisory. They are reported in the same shape as
 * deterministic violations so a host can render both through one code path, but a
 * protocol implementation may let a contributor acknowledge and proceed. Only the
 * deterministic layer is normative.
 */

/** Rule identifiers used by the semantic screen. */
export const S_RULES = Object.freeze({
  'S1-veiled-attack': 'An attack on a person or their motives, phrased indirectly.',
  'S2-sarcasm': 'Irony or sarcasm used to ridicule rather than to inform.',
  'S3-loaded-framing': 'Emotionally loaded framing dressed in neutral vocabulary.',
  'S4-misrepresentation': 'A source characterized in a way its title or venue makes implausible.',
  'S5-insinuation': 'A claim asserted by implication rather than stated in checkable form.'
});

/** The system prompt defining the screen. Part of the protocol, not of any vendor. */
export const SCREEN_SYSTEM = `You are the semantic admissibility screen for the Crucible Protocol, a structured truth-seeking debate format. You receive text that already passed deterministic rules. Report only violations the pattern layer cannot catch:
- veiled or implied attacks on persons or motives
- sarcasm or irony used to ridicule rather than inform
- emotionally loaded framing dressed in neutral vocabulary
- misrepresentation cues (a cited source characterized in a way its title or venue makes implausible)
- rhetorical moves that assert through insinuation rather than stating a checkable claim
Do NOT flag: position, strength of evidence, or conclusions you disagree with. The screen is content-neutral; it constrains form only.
Respond with ONLY a JSON object: {"pass": boolean, "violations": [{"rule": "S1-veiled-attack|S2-sarcasm|S3-loaded-framing|S4-misrepresentation|S5-insinuation", "excerpt": "...", "explanation": "...", "fix": "..."}]}. If nothing is wrong, {"pass": true, "violations": []}.`;

/**
 * Parses a raw model response into a screen result.
 *
 * Tolerant by design: models wrap JSON in prose, so the first balanced-looking
 * object in the text is used. Anything unparseable returns `skipped` rather than
 * throwing, because an unavailable advisory screen must never block a submission
 * that already satisfied the normative rules.
 *
 * @param {string} rawText
 * @returns {{pass:boolean, violations:Array}|{skipped:true, error:string}}
 */
export function parseSemanticScreenResponse(rawText) {
  const text = String(rawText || '');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { skipped: true, error: 'unparseable response' };
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    return { skipped: true, error: 'unparseable response' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { skipped: true, error: 'unparseable response' };
  }
  return {
    pass: parsed.pass === true,
    violations: Array.isArray(parsed.violations) ? parsed.violations : []
  };
}

/**
 * Builds the request payload a host should send, minus transport concerns.
 * Provided so hosts do not have to reconstruct the prompt themselves.
 */
export function buildScreenRequest(text) {
  return { system: SCREEN_SYSTEM, messages: [{ role: 'user', content: String(text || '') }] };
}

/** Renders submitted fields into the single text block the screen expects. */
export function fieldsToScreenText(fields) {
  return (fields || []).map(f => `${f.label}: ${f.text}`).join('\n\n');
}
