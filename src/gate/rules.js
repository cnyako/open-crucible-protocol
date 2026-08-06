/**
 * The Gate: rules G1 to G14.
 *
 * Every input passes here before it can enter the record. A rejected submission is
 * returned with the rule it violated, the offending excerpt, and how to fix it.
 * Nothing rejected becomes part of the debate, so there is nothing for a fallacy to
 * influence downstream.
 *
 * Rule shape:
 *   { id, name, description, global?, check(field, ctx), checkGlobal(fields, ctx) }
 *
 * A `global` rule sees all fields at once and the submission context. A per-field
 * rule is called once per non-empty field. Empty fields are skipped for per-field
 * rules, which is why an empty assertion is reported by G2 alone and not also by G3.
 */

import { LEX, ACRONYM_WHITELIST, WORD_LIMITS, PICTOGRAPH_RE } from './lexicons.js';
import { wordCount, findPhrases, excerptAround } from './text.js';

const CHALLENGE_GROUND_KEYS = ['evidence-validity', 'warrant-failure', 'relevance', 'counter-evidence'];
const CITED_APPEAL_GROUNDS = ['A1', 'A3'];
const CITED_CHALLENGE_GROUNDS = ['evidence-validity', 'counter-evidence'];

export const RULES = [
  {
    id: 'G1',
    name: 'Side declaration',
    description: 'Every contribution declares a contributor handle and the side it advocates for. Open participation, declared advocacy.',
    global: true,
    checkGlobal(fields, ctx) {
      const v = [];
      if (!ctx.author || !String(ctx.author).trim()) {
        v.push({
          message: 'No contributor handle given.',
          fix: 'Enter your handle. All contributions are attributed on the permanent record.'
        });
      }
      if (ctx.role !== 'arbiter' && !['A', 'B'].includes(ctx.side)) {
        v.push({
          message: 'No side declared for this contribution.',
          fix: 'Declare the side this contribution advocates for. Open contribution requires declared advocacy.'
        });
      }
      return v.map(x => ({ ...x, field: '(identity)', excerpt: '' }));
    }
  },

  {
    id: 'G2',
    name: 'Structural completeness',
    description: 'Claims must state assertion, grounds, an explicit warrant, a type, and a confidence qualifier. Unstated inference is where rhetoric hides.',
    global: true,
    checkGlobal(fields, ctx) {
      if (ctx.kind !== 'claim') return [];
      const v = [];
      for (const f of fields) {
        if (f.required && !String(f.text || '').trim()) {
          v.push({
            field: f.label, excerpt: '',
            message: `Required field "${f.label}" is empty.`,
            fix: 'A claim must state its assertion, grounds, and explicit warrant. Unstated inference is where rhetoric hides.'
          });
        }
      }
      if (!ctx.qualifier) {
        v.push({
          field: 'Qualifier', excerpt: '',
          message: 'No confidence qualifier selected.',
          fix: 'Declare how strongly the claim is held: certain, probable, or plausible.'
        });
      }
      return v;
    }
  },

  {
    id: 'G3',
    name: 'Atomicity',
    description: 'One atomic point per thread: assertion at most 50 words, grounds 150, warrant 80. Compound points split into separate threads.',
    check(f) {
      const limit = WORD_LIMITS[f.name];
      if (!limit) return [];
      const n = wordCount(f.text);
      if (n <= limit) return [];
      return [{
        field: f.label, excerpt: `${n} words (limit ${limit})`,
        message: `"${f.label}" exceeds the ${limit} word atomicity limit.`,
        fix: 'One claim per thread. Split compound points into separate claim threads so each can be tested independently.'
      }];
    }
  },

  {
    id: 'G4',
    name: 'No person-directed language',
    description: 'No ad hominem, no second-person accusations, no characterizations of opponents. Claims are about the world; challenges are about claims.',
    check(f) {
      const v = findPhrases(f.text, LEX.adHominem).map(hit => ({
        field: f.label, excerpt: excerptAround(f.text, hit),
        message: `Person-directed language: "${hit}".`,
        fix: 'Address the claim, not any person. Restate as a challenge to evidence, warrant, or relevance.'
      }));
      const text = String(f.text || '');
      const m = text.match(/\byou\s+(are|were|'re)\b/i) || text.match(/\bopponents?('s)?\b/i);
      if (m) {
        v.push({
          field: f.label, excerpt: excerptAround(text, m[0]),
          message: `Argument directed at a person ("${m[0]}").`,
          fix: 'Claims are about the world; challenges are about claims. Remove references to who is arguing.'
        });
      }
      return v;
    }
  },

  {
    id: 'G5',
    name: 'No loaded or emotive language',
    description: 'No outrage vocabulary. Emotive intensity is not evidence.',
    check(f) {
      return findPhrases(f.text, LEX.loaded).map(hit => ({
        field: f.label, excerpt: excerptAround(f.text, hit),
        message: `Loaded language: "${hit}".`,
        fix: 'Emotive intensity is not evidence. State the fact or inference neutrally and let the evidence tier carry the weight.'
      }));
    }
  },

  {
    id: 'G6',
    name: 'No humor, ridicule, or sarcasm',
    description: 'No jokes, mockery, or pictographs. Ridicule suppresses scrutiny instead of informing it.',
    check(f) {
      const v = findPhrases(f.text, LEX.humor).map(hit => ({
        field: f.label, excerpt: excerptAround(f.text, hit),
        message: `Humor or ridicule marker: "${hit}".`,
        fix: 'Ridicule suppresses scrutiny instead of informing it. Remove the joke and keep the point.'
      }));
      if (PICTOGRAPH_RE.test(String(f.text || ''))) {
        v.push({
          field: f.label, excerpt: '(pictograph)',
          message: 'Pictographs and emoji are not permitted in the record.',
          fix: 'Remove the pictograph and use words with checkable content. Arrows and mathematical operators are permitted.'
        });
      }
      return v;
    }
  },

  {
    id: 'G7',
    name: 'Formal register',
    description: 'No all-caps shouting and no exclamation marks.',
    check(f) {
      const v = [];
      const text = String(f.text || '');
      if (/!/.test(text)) {
        v.push({
          field: f.label, excerpt: excerptAround(text, '!'),
          message: 'Exclamation marks are not permitted.',
          fix: 'Emphasis is not evidence. End sentences with periods.'
        });
      }
      for (const caps of text.match(/\b[A-Z]{4,}\b/g) || []) {
        if (!ACRONYM_WHITELIST.has(caps)) {
          v.push({
            field: f.label, excerpt: excerptAround(text, caps),
            message: `All-caps emphasis: "${caps}".`,
            fix: 'Write in sentence case. If this is an acronym, define it in grounds on first use.'
          });
          break;
        }
      }
      return v;
    }
  },

  {
    id: 'G8',
    name: 'No rhetorical questions',
    description: 'No question marks in argumentative fields. Assertions must assert.',
    check(f) {
      if (!f.argumentative || !/\?/.test(String(f.text || ''))) return [];
      return [{
        field: f.label, excerpt: excerptAround(f.text, '?'),
        message: 'Question mark in an argumentative field.',
        fix: 'Assertions must assert. Convert the question into the statement you intend it to imply, then support it.'
      }];
    }
  },

  {
    id: 'G9',
    name: 'No appeal to popularity or obviousness',
    description: 'No appeals to what everyone knows, what is obvious, or what common sense dictates.',
    check(f) {
      return findPhrases(f.text, LEX.popularity).map(hit => ({
        field: f.label, excerpt: excerptAround(f.text, hit),
        message: `Appeal to popularity or obviousness: "${hit}".`,
        fix: 'What everyone knows is not a source. Cite the evidence directly or drop the appeal.'
      }));
    }
  },

  {
    id: 'G10',
    name: 'No unnamed authority',
    description: 'No invoking studies or experts in the abstract unless a specific citation is attached.',
    check(f, ctx) {
      if (ctx.evidenceCount > 0) return [];
      return findPhrases(f.text, LEX.unnamedAuthority).map(hit => ({
        field: f.label, excerpt: excerptAround(f.text, hit),
        message: `Unnamed authority: "${hit}" with no citation attached.`,
        fix: 'Name the study or expert and attach the citation with its evidence tier, or remove the appeal.'
      }));
    }
  },

  {
    id: 'G11',
    name: 'Citation required',
    description: 'Empirical claims require at least one checkable citation. Evidence-validity and counter-evidence challenges, and A1 and A3 appeals, require citations.',
    global: true,
    checkGlobal(fields, ctx) {
      const v = [];
      const uncited = !(ctx.evidenceCount > 0);
      if (ctx.kind === 'claim' && ctx.type === 'empirical' && uncited) {
        v.push({
          field: 'Evidence', excerpt: '',
          message: 'Empirical claim submitted with no citation.',
          fix: 'Empirical claims enter the record only with at least one checkable source, including a URL and an evidence tier.'
        });
      }
      if (ctx.kind === 'challenge' && CITED_CHALLENGE_GROUNDS.includes(ctx.ground) && uncited) {
        v.push({
          field: 'Evidence', excerpt: '',
          message: 'This challenge ground requires a citation.',
          fix: 'Challenges to evidence validity, and counter-evidence challenges, must cite the source that supports the objection.'
        });
      }
      if (ctx.kind === 'appeal' && CITED_APPEAL_GROUNDS.includes(ctx.ground) && uncited) {
        v.push({
          field: 'Evidence', excerpt: '',
          message: 'This appeal ground requires a citation.',
          fix: 'New-evidence and source-retraction appeals must cite the new or corrected source.'
        });
      }
      return v;
    }
  },

  {
    id: 'G12',
    name: 'No overclaiming',
    description: 'No certainty language unless the declared qualifier and evidence tier support certainty.',
    check(f, ctx) {
      const hits = findPhrases(f.text, LEX.overclaim);
      if (!hits.length) return [];
      const supported = ctx.qualifier === 'certain'
        && (ctx.kind !== 'claim' || ctx.type !== 'empirical' || ctx.maxTierWeight >= 5);
      if (supported) return [];
      return hits.map(hit => ({
        field: f.label, excerpt: excerptAround(f.text, hit),
        message: `Overclaiming: "${hit}" is not supported by the declared qualifier and evidence tier.`,
        fix: 'Match language to evidence. Use "indicates" or "supports", or raise the evidence tier and qualifier if certainty is truly warranted.'
      }));
    }
  },

  {
    id: 'G13',
    name: 'Challenge discipline',
    description: 'Challenges must select exactly one enumerated ground: evidence validity, warrant failure, relevance, or counter-evidence.',
    global: true,
    checkGlobal(fields, ctx) {
      if (ctx.kind !== 'challenge') return [];
      if (CHALLENGE_GROUND_KEYS.includes(ctx.ground)) return [];
      return [{
        field: 'Ground', excerpt: '',
        message: 'Challenge filed without one of the four enumerated grounds.',
        fix: 'Pick exactly one: evidence validity, warrant failure, relevance, or counter-evidence. Free-form objections are not admissible.'
      }];
    }
  },

  {
    id: 'G14',
    name: 'Steelman fidelity',
    description: 'Steelmans must carry no distancing or derision markers. State the opposing case as its strongest advocate would.',
    check(f, ctx) {
      if (ctx.kind !== 'steelman') return [];
      return findPhrases(f.text, LEX.steelmanDistance).map(hit => ({
        field: f.label, excerpt: excerptAround(f.text, hit),
        message: `Distancing or derision marker in a steelman: "${hit}".`,
        fix: 'A steelman states the opposing case as its strongest advocate would. Remove editorial distance and save disagreement for challenges.'
      }));
    }
  }
];

/**
 * Runs every applicable rule over a submission.
 *
 * @param {Array<{name?:string,label:string,text:string,argumentative?:boolean,required?:boolean}>} fields
 * @param {{kind:string, author?:string, side?:string, role?:string, type?:string,
 *          qualifier?:string, evidenceCount?:number, maxTierWeight?:number, ground?:string}} ctx
 * @returns {Array<{rule:string,ruleName:string,field:string,excerpt:string,message:string,fix:string}>}
 *          Empty when the submission is admissible.
 */
export function check(fields, ctx) {
  const list = fields || [];
  const context = ctx || {};
  const out = [];
  for (const rule of RULES) {
    if (rule.global) {
      for (const v of rule.checkGlobal(list, context)) {
        out.push({ rule: rule.id, ruleName: rule.name, ...v });
      }
    } else {
      for (const f of list) {
        if (!String(f.text || '').trim()) continue;
        for (const v of rule.check(f, context)) {
          out.push({ rule: rule.id, ruleName: rule.name, ...v });
        }
      }
    }
  }
  return out;
}
