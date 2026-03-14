export default defineBackground(() => {
  // Initialize default state
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ enabled: true, siteSettings: {} })
    updateBadge(true)
  })

  // Sync badge with storage state on startup
  chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
    const globalEnabled = result.enabled !== false
    updateBadgeForCurrentTab(globalEnabled, result.siteSettings as Record<string, boolean | 'default'> | undefined)
  })

  chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes.enabled || changes.siteSettings) {
      chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
        const globalEnabled = result.enabled !== false
        updateBadgeForCurrentTab(globalEnabled, result.siteSettings as Record<string, boolean | 'default'> | undefined)
      })
    }
  })

  // Refresh badge when user switches tabs or navigates
  chrome.tabs.onActivated.addListener(() => {
    chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
      const globalEnabled = result.enabled !== false
      updateBadgeForCurrentTab(globalEnabled, result.siteSettings as Record<string, boolean | 'default'> | undefined)
    })
  })

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
        const globalEnabled = result.enabled !== false
        const siteSettings = result.siteSettings as Record<string, boolean | 'default'> | undefined
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError || !tab.url) return
          const hostname = hostnameFromUrl(tab.url)
          const effective = effectiveEnabled(globalEnabled, hostname, siteSettings)
          updateBadge(effective, tabId)
        })
      })
    }
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
      updateBadge(globalEnabled)
      return
    }
    const hostname = hostnameFromUrl(tab.url)
    const effective = effectiveEnabled(globalEnabled, hostname, siteSettings)
    updateBadge(effective, tab.id)
  })
}

function updateBadge(enabled: boolean, tabId?: number) {
  const color = enabled ? '#22c55e' : '#9ca3af' // green active, gray inactive
  const text = enabled ? 'ON' : 'OFF'

  const opts = tabId !== undefined ? { color, tabId } : { color }
  const textOpts = tabId !== undefined ? { text, tabId } : { text }

  chrome.action.setBadgeBackgroundColor(opts)
  chrome.action.setBadgeText(textOpts)
}
