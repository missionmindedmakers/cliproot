import type { CrpBundle } from '@cliproot/protocol'
import type { ClipboardWriteOptions } from './types.js'
import { escapeAttr } from './html-utils.js'

/**
 * Write provenance data via the Async Clipboard API (Approach B).
 * Includes text/plain, text/html (with data-crp-bundle), and
 * web application/x-cliproot+json in a single ClipboardItem.
 *
 * Non-fatal: returns false if unsupported or if the write fails.
 */
export async function writeCustomFormatToClipboard(
  bundle: CrpBundle,
  text: string,
  htmlWithBundle: string
): Promise<boolean> {
  try {
    if (
      typeof ClipboardItem === 'undefined' ||
      !ClipboardItem.supports?.('web application/x-cliproot+json')
    ) {
      return false
    }

    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([htmlWithBundle], { type: 'text/html' }),
        'web application/x-cliproot+json': new Blob([JSON.stringify(bundle)], {
          type: 'application/json',
        }),
      }),
    ])
    return true
  } catch {
    return false
  }
}

/**
 * Write provenance data to clipboardData by augmenting the HTML content.
 *
 * Approach A: Appends a hidden div with data-crp-bundle attribute to the HTML.
 * Preserves any existing site-written HTML content.
 */
export function writeProvenanceToClipboard(
  bundle: CrpBundle,
  clipboardData: DataTransfer,
  options?: ClipboardWriteOptions
): void {
  if (options?.skipHtml) {
    return
  }

  const bundleJson = JSON.stringify(bundle)
  const provenanceHtml = `<div style="display:none" data-crp-bundle="${escapeAttr(bundleJson)}"></div>`

  // Get existing HTML or fall back to plain text wrapped in a span
  const existingHtml = clipboardData.getData('text/html')
  const plainText = clipboardData.getData('text/plain')

  let finalHtml: string
  if (existingHtml) {
    finalHtml = existingHtml + provenanceHtml
  } else if (plainText) {
    finalHtml = `<span>${escapeHtmlContent(plainText)}</span>${provenanceHtml}`
  } else {
    finalHtml = provenanceHtml
  }

  clipboardData.setData('text/html', finalHtml)
}

function escapeHtmlContent(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
