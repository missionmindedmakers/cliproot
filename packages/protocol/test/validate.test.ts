import { readFileSync } from 'node:fs';

import {
  ACTIVITY_TYPES,
  AGENT_TYPES,
  BUNDLE_TYPES,
  SOURCE_TYPES,
  parseBundle,
  CRP_V0_0_1_SCHEMA,
  SppValidationError,
  validateBundle,
} from '../src/index.js';
import type { SppBundle } from '../src/types.js';

function readFixture(): SppBundle {
  const fixtureUrl = new URL('../schema/examples/crp-v0.0.1.document.example.json', import.meta.url);
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as SppBundle;
}

describe('validateBundle', () => {
  it('validates the canonical example fixture', () => {
    const result = validateBundle(readFixture());
    expect(result.ok).toBe(true);
  });

  it('accepts a minimal valid bundle', () => {
    const result = validateBundle({
      protocolVersion: '0.0.1',
      bundleType: 'document',
      createdAt: '2026-03-07T20:30:00Z',
    });

    expect(result.ok).toBe(true);
  });

  it('reports required top-level fields', () => {
    const result = validateBundle({
      bundleType: 'document',
      createdAt: '2026-03-07T20:30:00Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.some((issue) => issue.instancePath === '/protocolVersion')).toBe(true);
  });

  it('reports invalid bundleType', () => {
    const bundle = readFixture();
    const result = validateBundle({
      ...bundle,
      bundleType: 'invalid',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.some((issue) => issue.instancePath === '/bundleType')).toBe(true);
  });

  it('rejects additional properties', () => {
    const bundle = readFixture();
    const result = validateBundle({
      ...bundle,
      document: {
        ...bundle.document,
        extra: true,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.some((issue) => issue.keyword === 'additionalProperties')).toBe(true);
  });

  it('rejects malformed textHash', () => {
    const bundle = readFixture();
    const result = validateBundle({
      ...bundle,
      spans: bundle.spans?.map((span, index) =>
        index === 0
          ? {
              ...span,
              textHash: 'not-a-sha256-hash',
            }
          : span,
      ),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.some((issue) => issue.instancePath.endsWith('/textHash'))).toBe(true);
  });

  it('rejects malformed date-time', () => {
    const bundle = readFixture();
    const result = validateBundle({
      ...bundle,
      createdAt: 'not-a-date',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.some((issue) => issue.instancePath === '/createdAt')).toBe(true);
  });

  it('rejects invalid sourceType and activityType values', () => {
    const bundle = readFixture();
    const result = validateBundle({
      ...bundle,
      sources: bundle.sources?.map((source, index) =>
        index === 0
          ? {
              ...source,
              sourceType: 'bad-source-type',
            }
          : source,
      ),
      activities: bundle.activities?.map((activity, index) =>
        index === 0
          ? {
              ...activity,
              activityType: 'bad-activity-type',
            }
          : activity,
      ),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.some((issue) => issue.instancePath.endsWith('/sourceType'))).toBe(true);
    expect(result.errors.some((issue) => issue.instancePath.endsWith('/activityType'))).toBe(true);
  });

  it('rejects spans missing textQuote selector and empty sourceRefs', () => {
    const bundle = readFixture();
    const firstSpan = bundle.spans?.[0];
    if (!firstSpan) {
      throw new Error('Fixture missing first span.');
    }

    const result = validateBundle({
      ...bundle,
      spans: [
        {
          ...firstSpan,
          sourceRefs: [],
          selectors: {
            textPosition: firstSpan.selectors.textPosition,
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.errors.some((issue) => issue.instancePath.endsWith('/sourceRefs'))).toBe(true);
    expect(
      result.errors.some((issue) => issue.instancePath.endsWith('/selectors/textQuote')),
    ).toBe(true);
  });
});

describe('parseBundle', () => {
  it('returns typed bundle for valid inputs', () => {
    const parsed = parseBundle(readFixture());
    expect(parsed.bundleType).toBe('document');
  });

  it('throws SppValidationError with issue details for invalid input', () => {
    const invalid = {
      protocolVersion: '0.0.1',
      bundleType: 'invalid',
      createdAt: 'bad-date',
    };

    const validateResult = validateBundle(invalid);
    expect(validateResult.ok).toBe(false);
    if (validateResult.ok) {
      return;
    }

    try {
      parseBundle(invalid);
      throw new Error('Expected parseBundle to throw.');
    } catch (error) {
      expect(error).toBeInstanceOf(SppValidationError);
      const typed = error as SppValidationError;
      expect(typed.issues).toEqual(validateResult.errors);
    }
  });
});

describe('schema enum constants', () => {
  it('matches schema enum definitions', () => {
    expect(BUNDLE_TYPES).toEqual(CRP_V0_0_1_SCHEMA.properties.bundleType.enum);
    expect(SOURCE_TYPES).toEqual(CRP_V0_0_1_SCHEMA.$defs.sourceRecord.properties.sourceType.enum);
    expect(AGENT_TYPES).toEqual(CRP_V0_0_1_SCHEMA.$defs.agent.properties.agentType.enum);
    expect(ACTIVITY_TYPES).toEqual(CRP_V0_0_1_SCHEMA.$defs.activity.properties.activityType.enum);
  });
});
