import { describe, expect, it } from 'vitest'
import { createRateLimiter } from '../src/ws/rateLimiter.ts'

describe('createRateLimiter', () => {
  it('allows up to the cap, then blocks within the window', () => {
    let t = 1000
    const rl = createRateLimiter(3, 1000, () => t)
    expect([rl.allow(), rl.allow(), rl.allow()]).toEqual([true, true, true])
    expect(rl.allow()).toBe(false) // 4th in the same window
  })

  it('resets when the window rolls over', () => {
    let t = 1000
    const rl = createRateLimiter(2, 1000, () => t)
    expect(rl.allow()).toBe(true)
    expect(rl.allow()).toBe(true)
    expect(rl.allow()).toBe(false)
    t += 1000 // new window
    expect(rl.allow()).toBe(true)
  })
})
