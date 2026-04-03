import {
  captureSelection,
  buildClipboardBundle,
  writeProvenanceToClipboard,
  writeCustomFormatToClipboard,
  parseBundleFromHtml,
  escapeAttr
} from '@cliproot/core'
import type { CapturedSelection } from '@cliproot/core'
import { createTextHash } from '@cliproot/protocol/hash'
import type { CrpBundle } from '@cliproot/protocol/types'
import type { ClipCapturedMessage, GetPageClipsResponse, PasteDetectedMessage } from '../types'
import { anchorClip } from '../anchoring'
import { injectStyles, highlightRange, removeHighlights } from '../highlighter'

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    let globalEnabled = true
    let siteOverride: boolean | 'default' = 'default'
    let highlightsEnabled = true
    let highlightsRendered = false
    let pendingCapture: { captured: CapturedSelection; bundle: CrpBundle } | null = null
    let bubbleListenerFired = false

    function isEnabled(): boolean {
      if (siteOverride !== 'default') return siteOverride as boolean
      return globalEnabled
    }

    // Sync enabled state from storage
    chrome.storage.local.get(
      ['enabled', 'siteSettings', 'highlightsEnabled'],
      (result: Record<string, unknown>) => {
        globalEnabled = result.enabled !== false
        highlightsEnabled = result.highlightsEnabled !== false
        const siteSettings = (result.siteSettings ?? {}) as Record<string, boolean | 'default'>
        const hostname = location.hostname
        siteOverride = hostname in siteSettings ? siteSettings[hostname] : 'default'

        // Trigger highlights after initial settings load
        scheduleHighlights()
      }
    )

    chrome.storage.onChanged.addListener(
      (changes: Record<string, chrome.storage.StorageChange>) => {
        if (changes.enabled) {
          globalEnabled = changes.enabled.newValue !== false
        }
        if (changes.siteSettings) {
          const siteSettings = (changes.siteSettings.newValue ?? {}) as Record<
            string,
            boolean | 'default'
          >
          const hostname = location.hostname
          siteOverride = hostname in siteSettings ? siteSettings[hostname] : 'default'
        }
        if (changes.highlightsEnabled) {
          highlightsEnabled = changes.highlightsEnabled.newValue !== false
          if (highlightsEnabled) {
            applyHighlights()
          } else {
            clearHighlights()
          }
        }
      }
    )

    // Apply highlights once the DOM is fully loaded
    function scheduleHighlights() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyHighlights(), { once: true })
      } else {
        applyHighlights()
      }
    }

    async function applyHighlights() {
      if (!highlightsEnabled || highlightsRendered) return

      let response: GetPageClipsResponse | undefined
      try {
        response = await chrome.runtime.sendMessage({
          type: 'get-page-clips',
          url: window.location.href
        })
      } catch {
        return
      }

      if (!response?.clips?.length) return

      injectStyles()

      for (const clip of response.clips) {
        if (!clip.selectors?.textQuote && !clip.content) continue
        try {
          const range = anchorClip(clip, document.body)
          if (range) {
            highlightRange(range, clip.clipHash)
          }
        } catch {
          // Best-effort — skip clips that can't be anchored
        }
      }

      highlightsRendered = true
    }

    function clearHighlights() {
      removeHighlights()
      highlightsRendered = false
    }

    // Re-apply when navigating within SPAs
    window.addEventListener('popstate', () => {
      clearHighlights()
      applyHighlights()
    })
    window.addEventListener('hashchange', () => {
      clearHighlights()
      applyHighlights()
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
          uri: window.location.href
        }
        if (document.title) {
          documentInfo.title = document.title
        }

        const bundle = buildClipboardBundle({
          captured,
          documentInfo
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

        // Capture the current selection range before it may be cleared
        const currentSelection = document.getSelection()
        const immediateRange =
          currentSelection && currentSelection.rangeCount > 0
            ? currentSelection.getRangeAt(0).cloneRange()
            : null

        const captured = pendingCapture.captured
        const clipHash = pendingCapture.bundle.clips?.[0]?.textHash ?? ''

        // Serialise selectors for background storage
        const selectorsJson = JSON.stringify({
          textQuote: captured.textQuote,
          textPosition: captured.textPosition,
          domSelector: captured.domSelector
        })

        // Notify background about the captured clip
        chrome.runtime.sendMessage({
          type: 'clip-captured',
          hostname: location.hostname,
          url: window.location.href,
          title: document.title,
          textPreview: captured.text?.substring(0, 80) ?? '',
          textHash: clipHash,
          fullText: captured.text ?? '',
          bundleJson: JSON.stringify(pendingCapture.bundle),
          selectorsJson
        } satisfies ClipCapturedMessage)

        pendingCapture = null

        // Immediately highlight the just-clipped text (no re-anchoring needed)
        if (highlightsEnabled && immediateRange && clipHash) {
          injectStyles()
          highlightRange(immediateRange, clipHash)
          highlightsRendered = true
        }
      },
      { capture: false }
    )

    // Paste detection — capture phase, READ-ONLY (never preventDefault)
    document.addEventListener(
      'paste',
      (event: ClipboardEvent) => {
        if (!isEnabled() || !event.clipboardData) return
        const plainText = event.clipboardData.getData('text/plain')
        if (!plainText) return

        const html = event.clipboardData.getData('text/html')
        let bundleJson: string | null = null
        if (html) {
          const bundle = parseBundleFromHtml(html)
          if (bundle) bundleJson = JSON.stringify(bundle)
        }

        const textHash = createTextHash(plainText)

        chrome.runtime.sendMessage({
          type: 'paste-detected',
          hostname: location.hostname,
          url: window.location.href,
          title: document.title,
          textPreview: plainText.substring(0, 80),
          textHash,
          bundleJson
        } satisfies PasteDetectedMessage)
      },
      { capture: true }
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

          // Firefox doesn't support navigator.clipboard.read()
          if (typeof navigator.clipboard?.read !== 'function') return

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
              'text/html': new Blob([finalHtml], { type: 'text/html' })
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
  }
})
