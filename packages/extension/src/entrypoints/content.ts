import { captureSelection, buildClipboardBundle, writeProvenanceToClipboard, writeCustomFormatToClipboard } from '@cliproot/core'
import type { CapturedSelection } from '@cliproot/core'
import type { CrpBundle } from '@cliproot/protocol'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    let globalEnabled = true
    let siteOverride: boolean | 'default' = 'default'
    let pendingCapture: { captured: CapturedSelection; bundle: CrpBundle } | null = null
    let bubbleListenerFired = false

    function isEnabled(): boolean {
      if (siteOverride !== 'default') return siteOverride as boolean
      return globalEnabled
    }

    // Sync enabled state from storage
    chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
      globalEnabled = result.enabled !== false
      const siteSettings = (result.siteSettings ?? {}) as Record<string, boolean | 'default'>
      const hostname = location.hostname
      siteOverride = hostname in siteSettings ? siteSettings[hostname] : 'default'
    })

    chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.enabled) {
        globalEnabled = changes.enabled.newValue !== false
      }
      if (changes.siteSettings) {
        const siteSettings = (changes.siteSettings.newValue ?? {}) as Record<string, boolean | 'default'>
        const hostname = location.hostname
        siteOverride = hostname in siteSettings ? siteSettings[hostname] : 'default'
      }
    })

    // Phase 1: Capture-phase listener — snapshot selection, build bundle, do NOT preventDefault
    document.addEventListener(
      'copy',
      (event: ClipboardEvent) => {
        if (!isEnabled()) return

        bubbleListenerFired = false
        pendingCapture = null

        const selection = document.getSelection()
        if (!selection || selection.isCollapsed) return

        const captured = captureSelection(selection, document)
        if (!captured) return

        const documentInfo: { uri: string; title?: string | undefined } = {
          uri: window.location.href,
        }
        if (document.title) {
          documentInfo.title = document.title
        }

        const bundle = buildClipboardBundle({
          captured,
          documentInfo,
        })

        pendingCapture = { captured, bundle }
        // Do NOT call event.preventDefault() — let the site handle the copy
      },
      { capture: true }
    )

    // Phase 2: Bubble-phase listener — augment whatever the site wrote with provenance
    document.addEventListener(
      'copy',
      (event: ClipboardEvent) => {
        if (!isEnabled() || !pendingCapture || !event.clipboardData) return

        bubbleListenerFired = true

        // If no site handler set plain text, seed it from our captured text so
        // clipboard-writer can build HTML from it and text/plain is preserved.
        if (!event.clipboardData.getData('text/plain') && pendingCapture.captured.text) {
          event.clipboardData.setData('text/plain', pendingCapture.captured.text)
        }

        writeProvenanceToClipboard(pendingCapture.bundle, event.clipboardData)
        event.preventDefault()

        // Attempt async write with custom MIME type (fire-and-forget)
        const augmentedHtml = event.clipboardData.getData('text/html')
        const plainText = event.clipboardData.getData('text/plain')
        const bundle = pendingCapture.bundle
        writeCustomFormatToClipboard(bundle, plainText, augmentedHtml)

        pendingCapture = null
      },
      { capture: false }
    )

    // Phase 3: Fallback — if bubble listener never fired (site called stopImmediatePropagation),
    // use setTimeout + Async Clipboard API as best-effort fallback
    document.addEventListener(
      'copy',
      () => {
        if (!isEnabled() || !pendingCapture) return

        const bundle = pendingCapture.bundle

        setTimeout(async () => {
          if (bubbleListenerFired) return

          try {
            const [existing] = await navigator.clipboard.read()
            if (!existing) return

            const htmlBlob = existing.types.includes('text/html')
              ? await existing.getType('text/html')
              : null

            const existingHtml = htmlBlob ? await htmlBlob.text() : ''
            const bundleJson = JSON.stringify(bundle)
            const provenanceHtml = `<div style="display:none" data-crp-bundle="${escapeAttr(bundleJson)}"></div>`
            const finalHtml = existingHtml + provenanceHtml

            const textBlob = existing.types.includes('text/plain')
              ? await existing.getType('text/plain')
              : new Blob([''], { type: 'text/plain' })

            const plainText = await textBlob.text()

            const clipboardItem: Record<string, Blob> = {
              'text/plain': textBlob,
              'text/html': new Blob([finalHtml], { type: 'text/html' }),
            }

            // Include custom MIME if supported
            if (
              typeof ClipboardItem !== 'undefined' &&
              ClipboardItem.supports?.('web application/x-cliproot+json')
            ) {
              clipboardItem['web application/x-cliproot+json'] = new Blob(
                [JSON.stringify(bundle)],
                { type: 'application/json' }
              )
            }

            await navigator.clipboard.write([new ClipboardItem(clipboardItem)])
          } catch {
            // Best-effort — async clipboard API may not be available
          }
        }, 0)
      },
      { capture: true }
    )
  },
})

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
