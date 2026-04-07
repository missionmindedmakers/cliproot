import type { CrpBundle } from '@cliproot/protocol'
import { validateBundle } from '@cliproot/protocol'
import { parseBundleFromHtml as parseBundleFromHtmlCore } from '@cliproot/core'

const CLIPROOT_MIME = 'web application/x-cliproot+json'

export function isClipboardReadSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.read === 'function'
}

export async function readCliprootFromClipboard(): Promise<{
  bundle: CrpBundle | null
  error?: string
}> {
  try {
    const items = await navigator.clipboard.read()
    console.log('[cliproot] Clipboard items:', items.length)
    for (const item of items) {
      console.log('[cliproot] Item types:', item.types)

      // Approach B: custom MIME type (best case)
      if (item.types.includes(CLIPROOT_MIME)) {
        console.log('[cliproot] Found custom MIME type')
        const blob = await item.getType(CLIPROOT_MIME)
        const text = await blob.text()
        console.log('[cliproot] Custom MIME payload (first 200 chars):', text.slice(0, 200))
        const parsed: unknown = JSON.parse(text)
        const result = validateBundle(parsed)
        if (result.ok) {
          console.log('[cliproot] Bundle validated from custom MIME')
          return { bundle: result.value }
        }
        console.warn('[cliproot] Custom MIME validation failed:', result.errors)
        return {
          bundle: null,
          error: `Validation failed: ${result.errors.map((e) => e.message).join(', ')}`
        }
      }

      // Approach A fallback: extract bundle from HTML data-crp-bundle attribute
      if (item.types.includes('text/html')) {
        console.log('[cliproot] No custom MIME — trying HTML fallback')
        const htmlBlob = await item.getType('text/html')
        const html = await htmlBlob.text()
        console.log('[cliproot] HTML content (first 3000 chars):', html.slice(0, 3000))
        const bundle = parseBundleFromHtml(html)
        if (bundle) {
          console.log('[cliproot] Bundle extracted from HTML fallback')
          return { bundle }
        }
        console.log('[cliproot] No data-crp-bundle attribute found in HTML')
      }
    }
    console.log('[cliproot] No Cliproot data found in any clipboard item')
    return {
      bundle: null,
      error:
        'No Cliproot data found in clipboard. Copy text from a site with the Cliproot extension first.'
    }
  } catch (err) {
    console.error('[cliproot] Clipboard read error:', err)
    return {
      bundle: null,
      error: `Clipboard read failed: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

/**
 * Extract a bundle from a paste event's DataTransfer.
 * This avoids the Clipboard API permission prompt since paste events
 * are user-initiated.
 */
export function readCliprootFromPasteEvent(e: ClipboardEvent): {
  bundle: CrpBundle | null
  error?: string
} {
  const clipboardData = e.clipboardData
  if (!clipboardData) {
    console.log('[cliproot:paste] No clipboardData on event')
    return { bundle: null, error: 'No clipboard data in paste event.' }
  }

  console.log('[cliproot:paste] Available types:', clipboardData.types)

  // Try custom MIME first
  const customJson = clipboardData.getData(CLIPROOT_MIME)
  if (customJson) {
    console.log('[cliproot:paste] Found custom MIME in paste event')
    try {
      const parsed: unknown = JSON.parse(customJson)
      const result = validateBundle(parsed)
      if (result.ok) {
        console.log('[cliproot:paste] Bundle validated from custom MIME')
        return { bundle: result.value }
      }
      return {
        bundle: null,
        error: `Validation failed: ${result.errors.map((e) => e.message).join(', ')}`
      }
    } catch {
      console.warn('[cliproot:paste] Failed to parse custom MIME JSON')
    }
  }

  // Fallback: extract from HTML
  const html = clipboardData.getData('text/html')
  if (html) {
    console.log('[cliproot:paste] Trying HTML fallback, length:', html.length)
    console.log('[cliproot:paste] HTML (first 3000 chars):', html.slice(0, 3000))
    const bundle = parseBundleFromHtml(html)
    if (bundle) {
      console.log('[cliproot:paste] Bundle extracted from HTML')
      return { bundle }
    }
    console.log('[cliproot:paste] No data-crp-bundle found in HTML')
  }

  console.log('[cliproot:paste] No Cliproot data found in paste event')
  return {
    bundle: null,
    error: 'No Cliproot data found. Copy text from a site with the Cliproot extension first.'
  }
}

/**
 * Wraps core's parseBundleFromHtml with full schema validation.
 * Core uses a lightweight structural check (CSP-safe), but in the
 * playground we can afford full AJV validation.
 */
function parseBundleFromHtml(html: string): CrpBundle | null {
  const bundle = parseBundleFromHtmlCore(html)
  if (!bundle) return null

  const result = validateBundle(bundle)
  if (result.ok) {
    return result.value
  }
  console.warn('[cliproot] HTML bundle validation failed:', result.errors)
  return null
}
