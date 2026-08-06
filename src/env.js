/**
 * Injected environment: the clock and the id generator.
 *
 * Every function that writes to a debate record takes its `now` and `newId` from
 * here rather than calling `Date.now()` or `Math.random()` inline. That makes a
 * whole debate document reproducible, which is what allows tests to assert on
 * complete records instead of on hand-picked fields.
 */

let _counter = 0;

/**
 * Default id generator: a monotonic counter plus a short random suffix.
 *
 * Deliberately not `crypto.randomUUID`. That is available in Node 19+ and in
 * browsers, but browsers gate it behind secure contexts, so it would work on
 * localhost and then fail the moment a page is served from a LAN address over
 * plain http. This has no environment dependency.
 */
export function defaultNewId(prefix) {
  return `${prefix}_${(++_counter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const defaultEnv = Object.freeze({
  now: () => Date.now(),
  newId: defaultNewId
});

/**
 * Test helper. Returns a clock that starts at `startMs` and advances by `stepMs`
 * on every call, so timestamps are distinct and reproducible.
 */
export function fixedClock(startMs, stepMs = 1000) {
  let t = startMs;
  const clock = () => { const v = t; t += stepMs; return v; };
  clock.reset = () => { t = startMs; };
  return clock;
}

/** Test helper. Returns an id generator producing `prefix_1`, `prefix_2`, and so on. */
export function counterIds() {
  const counts = new Map();
  return prefix => {
    const n = (counts.get(prefix) || 0) + 1;
    counts.set(prefix, n);
    return `${prefix}_${n}`;
  };
}

/** Fills in any missing member of an environment from the defaults. */
export function resolveEnv(env) {
  return {
    now: (env && env.now) || defaultEnv.now,
    newId: (env && env.newId) || defaultEnv.newId
  };
}
