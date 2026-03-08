import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

function toBase64Url(input: Uint8Array): string {
  const maybeBuffer = (
    globalThis as {
      Buffer?: {
        from(data: Uint8Array): { toString(encoding: 'base64'): string };
      };
    }
  ).Buffer;

  if (maybeBuffer) {
    return maybeBuffer
      .from(input)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  const maybeBtoa = (globalThis as { btoa?: (value: string) => string }).btoa;
  if (!maybeBtoa) {
    throw new Error('No base64 encoder is available in this runtime.');
  }

  let binary = '';
  for (const byte of input) {
    binary += String.fromCharCode(byte);
  }

  return maybeBtoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function normalizeForHash(text: string): string {
  return text.normalize('NFC').replace(/\r\n?/g, '\n');
}

export function createTextHash(text: string): `sha256-${string}` {
  const normalized = normalizeForHash(text);
  const digest = sha256(utf8ToBytes(normalized));
  return `sha256-${toBase64Url(digest)}`;
}
