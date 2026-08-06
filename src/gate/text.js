/** Text utilities shared by the Gate rules. Pure, no I/O. */

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Scans `text` for each phrase in `phrases`, requiring alphanumeric word boundaries
 * on both sides so that "liar" does not match inside "liars" and "hack" does not
 * match inside "hackathon".
 *
 * Returns at most one hit per phrase: the report needs to name the problem, not
 * enumerate every occurrence of it.
 */
export function findPhrases(text, phrases) {
  const hits = [];
  const source = String(text || '');
  const lower = source.toLowerCase();
  for (const phrase of phrases) {
    let idx = 0;
    while ((idx = lower.indexOf(phrase, idx)) !== -1) {
      const before = idx === 0 ? ' ' : lower[idx - 1];
      const afterPos = idx + phrase.length;
      const after = afterPos >= lower.length ? ' ' : lower[afterPos];
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
        hits.push(source.substr(idx, phrase.length));
        break;
      }
      idx += phrase.length;
    }
  }
  return hits;
}

/** Returns `needle` with up to 30 characters of surrounding context, for the report. */
export function excerptAround(text, needle) {
  const source = String(text || '');
  const i = source.toLowerCase().indexOf(String(needle).toLowerCase());
  if (i < 0) return needle;
  const start = Math.max(0, i - 30);
  const end = Math.min(source.length, i + needle.length + 30);
  return (start > 0 ? '...' : '') + source.slice(start, end) + (end < source.length ? '...' : '');
}
