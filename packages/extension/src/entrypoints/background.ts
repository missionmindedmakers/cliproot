import type {
  ClipCapturedMessage,
  PasteDetectedMessage,
  RecentClip,
  StoredClip,
  GetPageSourcesRequest,
  GetPageClipsRequest,
  GenerateBibliographyRequest,
  GetClipDetailRequest,
  SearchClipsRequest,
  PageSource,
  RegistryConnectRequest,
  RegistryDisconnectRequest,
  RegistryLoginRequest,
  RegistryPublishClipsRequest,
  RegistryStatusRequest,
  RegistryStatusResponse,
  RegistrySyncRequest
} from '../types'
import {
  storeClip,
  storeDocument,
  storeEdge,
  storeActivity,
  findClipsByTextHash,
  findClipsByDocumentId,
  findDocumentsByUri,
  findEdgesBySubjectRef,
  findEdgesByObjectRef,
  getClipByHash,
  getDocumentById,
  searchClips,
  getAllClips
} from '../db'
import { getRegistryClient } from '../registry'
import type { CrpBundle } from '@cliproot/protocol'

const tabClipCounts = new Map<number, number>()

/** Deterministic per-URL document ID. */
function documentIdFromUrl(url: string): string {
  // Strip fragment so the same page always maps to one document
  try {
    const u = new URL(url)
    u.hash = ''
    return `doc-${u.href}`
  } catch {
    return `doc-${url}`
  }
}

export default defineBackground(() => {
  // Initialize default state
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
      enabled: true,
      highlightsEnabled: true,
      siteSettings: {},
      recentClips: []
    })
    updateBadge(true, 0)

    chrome.contextMenus.create({
      id: 'cliproot-generate-bibliography',
      title: 'Generate bibliography',
      contexts: ['page']
    })
  })

  // Sync badge with storage state on startup
  chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
    const globalEnabled = result.enabled !== false
    updateBadgeForCurrentTab(
      globalEnabled,
      result.siteSettings as Record<string, boolean | 'default'> | undefined
    )
  })

  chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes.enabled || changes.siteSettings) {
      chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
        const globalEnabled = result.enabled !== false
        updateBadgeForCurrentTab(
          globalEnabled,
          result.siteSettings as Record<string, boolean | 'default'> | undefined
        )
      })
    }
  })

  // Handle messages from content scripts and popup
  type MessageType =
    | ClipCapturedMessage
    | PasteDetectedMessage
    | GetPageSourcesRequest
    | GetPageClipsRequest
    | GenerateBibliographyRequest
    | GetClipDetailRequest
    | SearchClipsRequest
    | RegistryConnectRequest
    | RegistryDisconnectRequest
    | RegistryLoginRequest
    | RegistryPublishClipsRequest
    | RegistryStatusRequest
    | RegistrySyncRequest

  chrome.runtime.onMessage.addListener(
    (message: MessageType, sender, sendResponse: (response: unknown) => void) => {
      if (message.type === 'clip-captured') {
        handleClipCaptured(message, sender)
      } else if (message.type === 'paste-detected') {
        handlePasteDetected(message)
      } else if (message.type === 'get-page-sources') {
        handleGetPageSources(message.url).then(sendResponse)
        return true
      } else if (message.type === 'get-page-clips') {
        handleGetPageClips(message.url).then(sendResponse)
        return true
      } else if (message.type === 'generate-bibliography') {
        handleGenerateBibliography(message.url, message.format).then(sendResponse)
        return true
      } else if (message.type === 'get-clip-detail') {
        handleGetClipDetail(message.clipHash).then(sendResponse)
        return true
      } else if (message.type === 'search-clips') {
        handleSearchClips(message.query).then(sendResponse)
        return true
      } else if (message.type === 'registry-connect') {
        handleRegistryConnect(message.url).then(sendResponse)
        return true
      } else if (message.type === 'registry-disconnect') {
        handleRegistryDisconnect().then(sendResponse)
        return true
      } else if (message.type === 'registry-login') {
        handleRegistryLogin().then(sendResponse)
        return true
      } else if (message.type === 'registry-publish-clips') {
        handleRegistryPublishClips(message.project).then(sendResponse)
        return true
      } else if (message.type === 'registry-status') {
        handleRegistryStatus().then(sendResponse)
        return true
      } else if (message.type === 'registry-sync') {
        handleRegistrySync(message.project).then(sendResponse)
        return true
      }
    }
  )

  // Context menu handler
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'cliproot-generate-bibliography' && tab?.url) {
      handleGenerateBibliography(tab.url, 'markdown').then((result) => {
        if (result.sourceCount === 0) return
        if (tab.id === undefined) return
        // Copy to clipboard via content script injection
        const code = `navigator.clipboard.writeText(${JSON.stringify(result.text)})`
        if (chrome.scripting?.executeScript) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (text: string) => {
              navigator.clipboard.writeText(text)
            },
            args: [result.text]
          })
        } else {
          // Firefox MV2 fallback
          browser.tabs.executeScript(tab.id, { code })
        }
      })
    }
  })

  // ── Registry handlers ──────────────────────────────────────

  async function handleRegistryConnect(url: string) {
    try {
      const client = getRegistryClient()
      const config = await client.connect(url)
      return { ok: true, config }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async function handleRegistryDisconnect() {
    try {
      const client = getRegistryClient()
      await client.disconnect()
      await chrome.storage.local.remove(['registryUser', 'registryAutoSync'])
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async function handleRegistryLogin() {
    try {
      const client = getRegistryClient()
      const connected = await client.isConnected()
      if (!connected) return { ok: false, error: 'Not connected to a registry' }

      const result = await chrome.storage.local.get('registryUrl')
      const registryUrl = result['registryUrl'] as string | undefined
      if (!registryUrl) return { ok: false, error: 'No registry URL configured' }

      // Open the registry sign-in page in a new tab
      const callbackUrl = chrome.runtime.getURL('options.html') + '?auth=callback'
      const { getAuthUrl } = await import('@cliproot/registry-client')
      const authUrl = getAuthUrl(registryUrl, callbackUrl)

      const tab = await chrome.tabs.create({ url: authUrl })
      // Listen for the redirect back to our options page
      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (tabId !== tab.id || changeInfo.status !== 'complete') return
          chrome.tabs.get(tabId, async (updatedTab) => {
            if (chrome.runtime.lastError || !updatedTab.url) return
            if (!updatedTab.url.includes('auth=callback')) return

            chrome.tabs.onUpdated.removeListener(listener)
            // Extract token from URL params if present, or check session
            try {
              const url = new URL(updatedTab.url)
              const token = url.searchParams.get('token')
              if (token) {
                const { ChromeStorageTokenStore } = await import('@cliproot/registry-client')
                const tokenStore = new ChromeStorageTokenStore()
                await tokenStore.setToken(token)
              }
              // Verify session
              const session = await client.checkAuth()
              if (session.valid && session.user) {
                await chrome.storage.local.set({ registryUser: session.user })
              }
              chrome.tabs.remove(tabId).catch(() => {})
              resolve({ ok: session.valid })
            } catch (err) {
              resolve({ ok: false, error: err instanceof Error ? err.message : String(err) })
            }
          })
        }
        chrome.tabs.onUpdated.addListener(listener)
      })
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async function handleRegistryPublishClips(project: string) {
    try {
      const client = getRegistryClient()
      const clips = await getAllClips()
      const bundles: CrpBundle[] = []

      for (const clip of clips) {
        if (!clip.bundleJson) continue
        try {
          bundles.push(JSON.parse(clip.bundleJson) as CrpBundle)
        } catch {
          // Skip malformed bundle JSON
        }
      }

      if (bundles.length === 0) {
        return { ok: true, accepted: 0 }
      }

      const result = await client.publishClips({ project, bundles })
      return { ok: true, accepted: result.accepted }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async function handleRegistryStatus(): Promise<RegistryStatusResponse> {
    const client = getRegistryClient()
    const connected = await client.isConnected()
    const result = await chrome.storage.local.get(['registryUrl', 'registryUser', 'registryAutoSync'])
    return {
      connected,
      registryUrl: (result['registryUrl'] as string) ?? null,
      user: (result['registryUser'] as RegistryStatusResponse['user']) ?? null,
      autoSync: (result['registryAutoSync'] as boolean) ?? false
    }
  }

  async function handleRegistrySync(project?: string) {
    const targetProject = project ?? 'default'
    return handleRegistryPublishClips(targetProject)
  }

  /** Auto-sync a single clip to the registry if enabled. */
  async function autoSyncClip(bundleJson: string | null) {
    if (!bundleJson) return
    const result = await chrome.storage.local.get(['registryAutoSync'])
    if (!result['registryAutoSync']) return

    try {
      const client = getRegistryClient()
      const connected = await client.isConnected()
      if (!connected) return

      const bundle = JSON.parse(bundleJson) as CrpBundle
      await client.publishClips({ project: 'default', bundles: [bundle] })
    } catch {
      // Best-effort — don't block capture on sync failure
    }
  }

  /**
   * Find the provenance sources for content pasted on a given page URL.
   *
   * Query path (all indexed):
   *   documents(uri=url) → clips(documentId) → edges(subjectRef)
   *     → parent clips → parent documents (for URL/title)
   */
  async function handleGetPageSources(url: string) {
    // 1. Find documents matching this URL
    const docs = await findDocumentsByUri(url)
    if (docs.length === 0) return { sources: [] }

    // 2. Find clips on those documents (the pasted-here clips)
    const childClips = (await Promise.all(docs.map((d) => findClipsByDocumentId(d.id)))).flat()

    // 3. For each child clip, find derivation edges pointing to it
    const edgesByParent = new Map<
      string,
      { parentClipHash: string; count: number; timestamps: number[] }
    >()

    for (const child of childClips) {
      const edges = (await findEdgesBySubjectRef(child.clipHash)).filter(
        (edge) => edge.edgeType === 'wasDerivedFrom'
      )
      for (const edge of edges) {
        const existing = edgesByParent.get(edge.objectRef)
        if (existing) {
          existing.count++
          existing.timestamps.push(new Date(edge.createdAt).getTime())
        } else {
          edgesByParent.set(edge.objectRef, {
            parentClipHash: edge.objectRef,
            count: 1,
            timestamps: [new Date(edge.createdAt).getTime()]
          })
        }
      }
    }

    // 4. Resolve parent clips + their documents for URL/title
    const sources: PageSource[] = []
    for (const [parentHash, info] of edgesByParent) {
      const parentClip = await getClipByHash(parentHash)
      if (!parentClip) continue

      const parentDoc = await getDocumentById(parentClip.documentId)

      sources.push({
        hostname: parentDoc ? hostnameFromUrl(parentDoc.uri) : '',
        url: parentDoc?.uri ?? '',
        title: parentDoc?.title ?? '',
        clipCount: info.count,
        clips: info.timestamps.map((ts) => ({
          clipHash: parentClip.clipHash,
          textPreview: parentClip.content.slice(0, 100),
          timestamp: ts
        }))
      })
    }

    return { sources }
  }

  async function handleGenerateBibliography(
    url: string,
    format: 'markdown' | 'numbered' | 'plain'
  ) {
    const { sources } = await handleGetPageSources(url)

    if (sources.length === 0) {
      return { text: '', sourceCount: 0 }
    }

    // Deduplicate by source URL
    const seen = new Set<string>()
    const unique = sources.filter((s) => {
      if (seen.has(s.url)) return false
      seen.add(s.url)
      return true
    })

    let text: string
    if (format === 'markdown') {
      text = unique.map((s) => `- [${s.title || s.hostname}](${s.url})`).join('\n')
    } else if (format === 'numbered') {
      text = unique.map((s, i) => `${i + 1}. ${s.title || s.hostname} — ${s.url}`).join('\n')
    } else {
      text = unique.map((s) => `${s.title || s.hostname}: ${s.url}`).join('\n')
    }

    return { text, sourceCount: unique.length }
  }

  async function handleGetClipDetail(clipHash: string) {
    const clip = (await getClipByHash(clipHash)) ?? null
    const edges = clip
      ? (await findEdgesByObjectRef(clipHash)).filter((edge) => edge.edgeType === 'wasDerivedFrom')
      : []
    return { clip, edges }
  }

  async function handleSearchClips(query: string) {
    const clips = await searchClips(query)
    return { clips }
  }

  async function handleGetPageClips(url: string) {
    const documentId = documentIdFromUrl(url)
    const clips = await findClipsByDocumentId(documentId)
    return { clips }
  }

  function handleClipCaptured(message: ClipCapturedMessage, sender: chrome.runtime.MessageSender) {
    const tabId = sender.tab?.id
    if (tabId === undefined) return

    // Increment per-tab count
    const count = (tabClipCounts.get(tabId) ?? 0) + 1
    tabClipCounts.set(tabId, count)

    // Persist to recentClips storage (FIFO, last 50)
    const recentClip: RecentClip = {
      url: message.url,
      hostname: message.hostname,
      title: message.title,
      timestamp: Date.now(),
      textPreview: message.textPreview
    }

    chrome.storage.local.get(['recentClips'], (result: Record<string, unknown>) => {
      const existing = (result.recentClips as RecentClip[]) ?? []
      const updated = [recentClip, ...existing].slice(0, 50)
      chrome.storage.local.set({ recentClips: updated })
    })

    const now = new Date().toISOString()
    const documentId = documentIdFromUrl(message.url)

    // Store document (per-URL identity)
    storeDocument({
      id: documentId,
      uri: message.url,
      title: message.title
    }).catch(() => {})

    // Parse selectors from the captured selection if provided
    let selectors: StoredClip['selectors'] | undefined
    if (message.selectorsJson) {
      try {
        const captured = JSON.parse(message.selectorsJson) as {
          textQuote?: { exact: string; prefix?: string; suffix?: string }
          textPosition?: { start: number; end: number }
          domSelector?: { elementId?: string; cssSelector?: string }
        }
        selectors = {}
        if (captured.textQuote) selectors.textQuote = captured.textQuote
        if (captured.textPosition) selectors.textPosition = captured.textPosition
        if (captured.domSelector) {
          selectors.dom = {}
          if (captured.domSelector.elementId)
            selectors.dom.elementId = captured.domSelector.elementId
          if (captured.domSelector.cssSelector)
            selectors.dom.cssSelector = captured.domSelector.cssSelector
        }
      } catch {
        // Best-effort — malformed JSON
      }
    }

    // Store clip as CRP object
    storeClip({
      clipHash: message.textHash,
      documentId,
      sourceRefs: [],
      textHash: message.textHash,
      content: message.fullText,
      selectors,
      createdAt: now,
      bundleJson: message.bundleJson
    }).catch(() => {
      // Best-effort — IndexedDB may be unavailable
    })

    // Store activity
    storeActivity({
      id: `act-copy-${Date.now()}`,
      activityType: 'copy',
      createdAt: now
    }).catch(() => {})

    // Auto-sync to registry if enabled
    autoSyncClip(message.bundleJson).catch(() => {})

    // Update badge with count
    chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
      const globalEnabled = result.enabled !== false
      const siteSettings = result.siteSettings as Record<string, boolean | 'default'> | undefined
      const hostname = message.hostname
      const effective = effectiveEnabled(globalEnabled, hostname, siteSettings)
      updateBadge(effective, count, tabId)
    })
  }

  function handlePasteDetected(message: PasteDetectedMessage) {
    const now = new Date().toISOString()
    const destDocumentId = documentIdFromUrl(message.url)

    // Store a document + clip for the destination page so that
    // handleGetPageSources can later trace edges back to sources
    storeDocument({
      id: destDocumentId,
      uri: message.url,
      title: message.title
    }).catch(() => {})

    // The pasted content is a clip on the destination page
    const destClipHash = `paste-${message.textHash}-${Date.now()}`
    storeClip({
      clipHash: destClipHash,
      documentId: destDocumentId,
      sourceRefs: [],
      textHash: message.textHash,
      content: message.textPreview,
      createdAt: now,
      bundleJson: message.bundleJson
    }).catch(() => {})

    findClipsByTextHash(message.textHash)
      .then((matchedClips) => {
        // Filter out the destination clip we just stored
        const sourceClips = matchedClips.filter((c) => c.clipHash !== destClipHash)

        if (message.bundleJson && sourceClips.length > 0) {
          // Bundle match — high confidence edge
          const parentClip = sourceClips[0]
          storeEdge({
            id: `edge-${Date.now()}`,
            edgeType: 'wasDerivedFrom',
            subjectRef: destClipHash,
            objectRef: parentClip.clipHash,
            transformationType: 'verbatim',
            confidence: 1.0,
            createdAt: now
          }).catch(() => {})
        } else if (sourceClips.length > 0) {
          // Hash match — verbatim with high confidence
          const parentClip = sourceClips[0]
          storeEdge({
            id: `edge-${Date.now()}`,
            edgeType: 'wasDerivedFrom',
            subjectRef: destClipHash,
            objectRef: parentClip.clipHash,
            transformationType: 'verbatim',
            confidence: 0.9,
            createdAt: now
          }).catch(() => {})
        }
        // matchMethod 'none' — no edge created

        // Store derive activity
        storeActivity({
          id: `act-derive-${Date.now()}`,
          activityType: 'derive',
          createdAt: now
        }).catch(() => {})
      })
      .catch(() => {
        // Best-effort — IndexedDB may be unavailable
      })
  }

  // Refresh badge when user switches tabs
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
      const globalEnabled = result.enabled !== false
      const siteSettings = result.siteSettings as Record<string, boolean | 'default'> | undefined
      const count = tabClipCounts.get(tabId) ?? 0
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab.url) {
          updateBadge(globalEnabled, count)
          return
        }
        const hostname = hostnameFromUrl(tab.url)
        const effective = effectiveEnabled(globalEnabled, hostname, siteSettings)
        updateBadge(effective, count, tabId)
      })
    })
  })

  // Reset count on navigation, clean up on tab close
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      tabClipCounts.delete(tabId)
    }

    if (changeInfo.status === 'complete') {
      chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
        const globalEnabled = result.enabled !== false
        const siteSettings = result.siteSettings as Record<string, boolean | 'default'> | undefined
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError || !tab.url) return
          const hostname = hostnameFromUrl(tab.url)
          const effective = effectiveEnabled(globalEnabled, hostname, siteSettings)
          const count = tabClipCounts.get(tabId) ?? 0
          updateBadge(effective, count, tabId)
        })
      })
    }
  })

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabClipCounts.delete(tabId)
  })
})

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function effectiveEnabled(
  globalEnabled: boolean,
  hostname: string,
  siteSettings: Record<string, boolean | 'default'> | undefined
): boolean {
  const override = siteSettings?.[hostname]
  if (override !== undefined && override !== 'default') return override as boolean
  return globalEnabled
}

function updateBadgeForCurrentTab(
  globalEnabled: boolean,
  siteSettings: Record<string, boolean | 'default'> | undefined
) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (!tab?.url) {
      updateBadge(globalEnabled, 0)
      return
    }
    const hostname = hostnameFromUrl(tab.url)
    const effective = effectiveEnabled(globalEnabled, hostname, siteSettings)
    const count = tab.id !== undefined ? (tabClipCounts.get(tab.id) ?? 0) : 0
    updateBadge(effective, count, tab.id)
  })
}

function updateBadge(enabled: boolean, clipCount: number, tabId?: number) {
  const color = enabled ? '#22c55e' : '#9ca3af'

  let text: string
  if (!enabled) {
    text = 'OFF'
  } else if (clipCount > 0) {
    text = String(clipCount)
  } else {
    text = ''
  }

  const opts = tabId !== undefined ? { color, tabId } : { color }
  const textOpts = tabId !== undefined ? { text, tabId } : { text }

  chrome.action.setBadgeBackgroundColor(opts)
  chrome.action.setBadgeText(textOpts)
}
