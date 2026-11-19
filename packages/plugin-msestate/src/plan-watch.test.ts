import { describe, expect, test } from 'bun:test'

describe('planIsStale', () => {
  test('no plan, or a plan from another model or other dimensions, is stale', async () => {
    const { planIsStale } = await import('./plan-watch')
    const plan = { drawn_at: '2026-11-19', glb_sha256: 'abcdef012345', dimensions: 2 }
    expect(planIsStale(null, 'abcdef012345', 2)).toBe(true)
    expect(planIsStale({ drawn_at: 'x' }, 'abcdef012345', 2)).toBe(true)
    expect(planIsStale(plan, '000000000000', 2)).toBe(true)
    expect(planIsStale(plan, 'abcdef012345', 3)).toBe(true)
    expect(planIsStale(plan, 'abcdef012345', 2)).toBe(false)
  })
})

describe('sha12', () => {
  test('matches the server: first 12 hex of SHA-256', async () => {
    const { sha12 } = await import('./plan-watch')
    // sha256("abc") = ba7816bf8f01cfea414140de5dae2223...
    expect(await sha12(new Blob(['abc']))).toBe('ba7816bf8f01')
  })
})
