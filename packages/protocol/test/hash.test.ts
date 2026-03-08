import { createTextHash, normalizeForHash } from '../src/hash.js';

describe('hash helpers', () => {
  it('normalizes NFC and newlines', () => {
    expect(normalizeForHash('Cafe\u0301\r\nline2\rline3')).toBe('Café\nline2\nline3');
  });

  it('produces deterministic hash vectors', () => {
    expect(createTextHash('Cafe\u0301')).toBe('sha256-c0c9zBK3YwhZBKUnnQSMTVs7AIxG8fMkQ7md4EqoOhQ');
    expect(createTextHash('Café')).toBe('sha256-c0c9zBK3YwhZBKUnnQSMTVs7AIxG8fMkQ7md4EqoOhQ');

    expect(createTextHash('line1\r\nline2')).toBe(
      'sha256-aDN24pCCm0gsJlV0XK_6eh3M-hCvqmLawrQt1saND4M',
    );
    expect(createTextHash('line1\nline2')).toBe(
      'sha256-aDN24pCCm0gsJlV0XK_6eh3M-hCvqmLawrQt1saND4M',
    );

    expect(createTextHash('')).toBe('sha256-47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU');
  });
});
