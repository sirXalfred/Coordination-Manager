/**
 * Tests for setup-view-overrides -- the localStorage-backed snapshot of
 * "what production looks like" that powers the Setup page Production view.
 *
 * These guard the invariants the SetupPage relies on:
 *  - TEMPLATE_DEFAULTS exposes the four deployment fields the page reads
 *    (NODE_ENV / PORT / FRONTEND_URL on api, VITE_API_URL on web)
 *  - set/get/clear round-trip cleanly
 *  - setting an empty value deletes the entry (so "is set" predicates work)
 *  - bot/guardian buckets are optional and don't crash the reader
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  TEMPLATE_DEFAULTS,
  getViewOverrides,
  setProductionOverride,
  clearProductionOverrides,
} from '../setup-view-overrides'

beforeEach(() => {
  localStorage.clear()
})

describe('TEMPLATE_DEFAULTS', () => {
  it('includes the four deployment fields the Setup page expects', () => {
    expect(TEMPLATE_DEFAULTS.api.NODE_ENV?.value).toBe('development')
    expect(TEMPLATE_DEFAULTS.api.PORT?.value).toBe('3001')
    expect(TEMPLATE_DEFAULTS.api.FRONTEND_URL?.value).toBe('http://localhost:5173')
    expect(TEMPLATE_DEFAULTS.web.VITE_API_URL?.value).toBe('http://localhost:3001')
  })

  it('never carries secret values (template is a fresh-clone reference)', () => {
    for (const target of Object.values(TEMPLATE_DEFAULTS)) {
      const entries = Object.values(target ?? {}) as Array<{ isSecret?: boolean } | undefined>
      for (const entry of entries) {
        expect(entry?.isSecret).not.toBe(true)
      }
    }
  })
})

describe('production overrides', () => {
  it('starts empty', () => {
    expect(getViewOverrides()).toEqual({
      production: { api: {}, web: {} },
    })
  })

  it('writes and reads back a non-secret value', () => {
    setProductionOverride('api', 'FRONTEND_URL', 'https://app.example.com')
    expect(getViewOverrides().production.api.FRONTEND_URL).toEqual({
      value: 'https://app.example.com',
      isSecret: false,
    })
  })

  it('marks the entry as secret when requested', () => {
    setProductionOverride('api', 'JWT_SECRET', 'super-secret', true)
    expect(getViewOverrides().production.api.JWT_SECRET).toEqual({
      value: 'super-secret',
      isSecret: true,
    })
  })

  it('writes to the web bucket', () => {
    setProductionOverride('web', 'VITE_API_URL', 'https://api.example.com')
    expect(getViewOverrides().production.web.VITE_API_URL?.value).toBe('https://api.example.com')
  })

  it('deletes the entry when value is empty (so isComponentFilledInOverrides flips back to false)', () => {
    setProductionOverride('api', 'FRONTEND_URL', 'https://app.example.com')
    expect(getViewOverrides().production.api.FRONTEND_URL).toBeDefined()
    setProductionOverride('api', 'FRONTEND_URL', '')
    expect(getViewOverrides().production.api.FRONTEND_URL).toBeUndefined()
  })

  it('clearProductionOverrides wipes every bucket', () => {
    setProductionOverride('api', 'FRONTEND_URL', 'https://app.example.com')
    setProductionOverride('web', 'VITE_API_URL', 'https://api.example.com')
    clearProductionOverrides()
    expect(getViewOverrides()).toEqual({
      production: { api: {}, web: {} },
    })
  })

  it('survives a corrupt JSON blob in localStorage without throwing', () => {
    localStorage.setItem('cm_setup_view_overrides_v1', '{not json')
    expect(() => getViewOverrides()).not.toThrow()
    expect(getViewOverrides()).toEqual({
      production: { api: {}, web: {} },
    })
  })

  it('treats missing api/web buckets in stored JSON as empty', () => {
    localStorage.setItem('cm_setup_view_overrides_v1', JSON.stringify({ production: {} }))
    expect(getViewOverrides().production.api).toEqual({})
    expect(getViewOverrides().production.web).toEqual({})
  })
})
