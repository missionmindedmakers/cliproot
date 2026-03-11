import { readFileSync } from 'node:fs'

import {
  ACTIVITY_TYPES,
  AGENT_TYPES,
  BUNDLE_TYPES,
  CrpValidationError,
  SOURCE_TYPES,
  parseBundle,
  CRP_V0_0_1_SCHEMA,
  validateBundle
} from '../src/index.js'
import type { CrpBundle } from '../src/types.js'

function readFixture(): CrpBundle {
  const fixtureUrl = new URL('../schema/examples/crp-v0.0.1.document.example.json', import.meta.url)
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as CrpBundle
}

describe('validateBundle', () => {
  it('validates the canonical example fixture', () => {
    const result = validateBundle(readFixture())
    expect(result.ok).toBe(true)
  })

  it('accepts a minimal valid bundle', () => {
    const result = validateBundle({
      protocolVersion: '0.0.1',
      bundleType: 'document',
      createdAt: '2026-03-07T20:30:00Z'
    })

    expect(result.ok).toBe(true)
  })

  it('reports required top-level fields', () => {
    const result = validateBundle({
      bundleType: 'document',
      createdAt: '2026-03-07T20:30:00Z'
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.instancePath === '/protocolVersion')).toBe(true)
  })

  it('reports invalid bundleType', () => {
    const bundle = readFixture()
    const result = validateBundle({
      ...bundle,
      bundleType: 'invalid'
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.instancePath === '/bundleType')).toBe(true)
  })

  it('rejects additional properties', () => {
    const bundle = readFixture()
    const result = validateBundle({
      ...bundle,
      document: {
        ...bundle.document,
        extra: true
      }
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.keyword === 'additionalProperties')).toBe(true)
  })

  it('rejects malformed textHash', () => {
    const bundle = readFixture()
    const result = validateBundle({
      ...bundle,
      clips: bundle.clips?.map((clip, index) =>
        index === 0
          ? {
              ...clip,
              textHash: 'not-a-sha256-hash'
            }
          : clip
      )
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.instancePath.endsWith('/textHash'))).toBe(true)
  })

  it('rejects malformed date-time', () => {
    const bundle = readFixture()
    const result = validateBundle({
      ...bundle,
      createdAt: 'not-a-date'
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.instancePath === '/createdAt')).toBe(true)
  })

  it('rejects invalid sourceType and activityType values', () => {
    const bundle = readFixture()
    const result = validateBundle({
      ...bundle,
      sources: bundle.sources?.map((source, index) =>
        index === 0
          ? {
              ...source,
              sourceType: 'bad-source-type'
            }
          : source
      ),
      activities: bundle.activities?.map((activity, index) =>
        index === 0
          ? {
              ...activity,
              activityType: 'bad-activity-type'
            }
          : activity
      )
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.instancePath.endsWith('/sourceType'))).toBe(true)
    expect(result.errors.some((issue) => issue.instancePath.endsWith('/activityType'))).toBe(true)
  })

  it('rejects clips missing textQuote selector and empty sourceRefs', () => {
    const bundle = readFixture()
    const firstClip = bundle.clips?.[0]
    if (!firstClip) {
      throw new Error('Fixture missing first clip.')
    }

    const result = validateBundle({
      ...bundle,
      clips: [
        {
          ...firstClip,
          sourceRefs: [],
          selectors: {
            textPosition: firstClip.selectors.textPosition
          }
        }
      ]
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.instancePath.endsWith('/sourceRefs'))).toBe(true)
    expect(result.errors.some((issue) => issue.instancePath.endsWith('/selectors/textQuote'))).toBe(
      true
    )
  })

  // --- Hybrid model: clipHash (decentralized identity) ---

  it('requires clipHash on every clip', () => {
    const bundle = readFixture()
    const firstClip = bundle.clips?.[0]
    if (!firstClip) {
      throw new Error('Fixture missing first clip.')
    }

    const { clipHash: _removed, ...clipWithoutHash } = firstClip as typeof firstClip & {
      clipHash: string
    }

    const result = validateBundle({
      ...bundle,
      clips: [clipWithoutHash]
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.instancePath.endsWith('/clipHash'))).toBe(true)
  })

  it('rejects malformed clipHash', () => {
    const bundle = readFixture()
    const result = validateBundle({
      ...bundle,
      clips: bundle.clips?.map((clip, index) =>
        index === 0
          ? {
              ...clip,
              clipHash: 'not-a-valid-hash'
            }
          : clip
      )
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.instancePath.endsWith('/clipHash'))).toBe(true)
  })

  it('accepts a clip with only textQuote selector (textPosition optional)', () => {
    const bundle = readFixture()
    const firstClip = bundle.clips?.[0]
    if (!firstClip) {
      throw new Error('Fixture missing first clip.')
    }

    const result = validateBundle({
      ...bundle,
      clips: [
        {
          ...firstClip,
          selectors: {
            textQuote: { exact: 'Provenance starts here.' }
          }
        }
      ]
    })

    expect(result.ok).toBe(true)
  })

  it('accepts a clip with embedded content field', () => {
    const bundle = readFixture()
    const firstClip = bundle.clips?.[0]
    if (!firstClip) {
      throw new Error('Fixture missing first clip.')
    }

    const result = validateBundle({
      ...bundle,
      clips: [
        {
          ...firstClip,
          content: 'Provenance starts here.'
        }
      ]
    })

    expect(result.ok).toBe(true)
  })

  it('accepts a clip with derivedFrom lineage chain', () => {
    const bundle = readFixture()
    const firstClip = bundle.clips?.[0]
    if (!firstClip) {
      throw new Error('Fixture missing first clip.')
    }

    const result = validateBundle({
      ...bundle,
      clips: [
        {
          ...firstClip,
          derivedFrom: [{ clipHash: 'sha256-ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ' }]
        }
      ]
    })

    expect(result.ok).toBe(true)
  })

  it('rejects a derivedFrom entry with malformed clipHash', () => {
    const bundle = readFixture()
    const firstClip = bundle.clips?.[0]
    if (!firstClip) {
      throw new Error('Fixture missing first clip.')
    }

    const result = validateBundle({
      ...bundle,
      clips: [
        {
          ...firstClip,
          derivedFrom: [{ clipHash: 'bad-hash' }]
        }
      ]
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.instancePath.includes('derivedFrom'))).toBe(true)
  })

  // --- Hybrid model: optional registry ---

  it('accepts a bundle with an optional registry declaration', () => {
    const bundle = readFixture()
    const result = validateBundle({
      ...bundle,
      registry: {
        uri: 'https://registry.cliproot.org',
        bundleId: 'bundle_doc_01'
      }
    })

    expect(result.ok).toBe(true)
  })

  it('accepts a bundle without a registry (registry is optional)', () => {
    const bundle = readFixture()
    const { registry: _removed, ...bundleWithoutRegistry } = bundle as typeof bundle & {
      registry: unknown
    }

    const result = validateBundle(bundleWithoutRegistry)
    expect(result.ok).toBe(true)
  })

  it('rejects a registry entry missing required uri', () => {
    const bundle = readFixture()
    const result = validateBundle({
      ...bundle,
      registry: {
        bundleId: 'bundle_doc_01'
      }
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.errors.some((issue) => issue.instancePath.includes('registry'))).toBe(true)
  })

  // --- clip id is now optional ---

  it('accepts a clip without an id (id is optional local alias)', () => {
    const bundle = readFixture()
    const firstClip = bundle.clips?.[0]
    if (!firstClip) {
      throw new Error('Fixture missing first clip.')
    }

    const { id: _removed, ...clipWithoutId } = firstClip as typeof firstClip & { id: string }

    const result = validateBundle({
      ...bundle,
      clips: [clipWithoutId]
    })

    expect(result.ok).toBe(true)
  })
})

describe('parseBundle', () => {
  it('returns typed bundle for valid inputs', () => {
    const parsed = parseBundle(readFixture())
    expect(parsed.bundleType).toBe('document')
  })

  it('throws CrpValidationError with issue details for invalid input', () => {
    const invalid = {
      protocolVersion: '0.0.1',
      bundleType: 'invalid',
      createdAt: 'bad-date'
    }

    const validateResult = validateBundle(invalid)
    expect(validateResult.ok).toBe(false)
    if (validateResult.ok) {
      return
    }

    try {
      parseBundle(invalid)
      throw new Error('Expected parseBundle to throw.')
    } catch (error) {
      expect(error).toBeInstanceOf(CrpValidationError)
      const typed = error as CrpValidationError
      expect(typed.issues).toEqual(validateResult.errors)
    }
  })
})

describe('schema enum constants', () => {
  it('matches schema enum definitions', () => {
    expect(BUNDLE_TYPES).toEqual(CRP_V0_0_1_SCHEMA.properties.bundleType.enum)
    expect(SOURCE_TYPES).toEqual(CRP_V0_0_1_SCHEMA.$defs.sourceRecord.properties.sourceType.enum)
    expect(AGENT_TYPES).toEqual(CRP_V0_0_1_SCHEMA.$defs.agent.properties.agentType.enum)
    expect(ACTIVITY_TYPES).toEqual(CRP_V0_0_1_SCHEMA.$defs.activity.properties.activityType.enum)
  })
})
