/**
 * A fixed-window per-connection rate limiter (spec §7 "per-connection rate
 * limits"). Counts events in the current window; `allow()` returns false once
 * the cap is exceeded until the window rolls over. `now` is injectable for tests.
 */
export interface RateLimiter {
  allow(): boolean
}

export function createRateLimiter(
  maxPerWindow: number,
  windowMs: number,
  now: () => number = () => Date.now(),
): RateLimiter {
  let windowStart = now()
  let count = 0
  return {
    allow() {
      const t = now()
      if (t - windowStart >= windowMs) {
        windowStart = t
        count = 0
      }
      count += 1
      return count <= maxPerWindow
    },
  }
}
