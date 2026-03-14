const statusEl = document.getElementById('status')!
const toggleBtn = document.getElementById('toggle')!
const siteControls = document.getElementById('site-controls')!
const siteHostnameEl = document.getElementById('site-hostname')!
const siteToggleGroup = document.getElementById('site-toggle-group')!
const effectiveStatusEl = document.getElementById('effective-status')!

let currentHostname = ''
let globalEnabled = true
let siteSettings: Record<string, boolean | 'default'> = {}

function isRestrictedUrl(url: string): boolean {
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('file://') ||
    url.startsWith('about:') ||
    url.startsWith('edge://')
  )
}

function effectiveEnabled(hostname: string): boolean {
  const override = siteSettings[hostname]
  if (override !== undefined && override !== 'default') return override as boolean
  return globalEnabled
}

function updateGlobalUI(enabled: boolean) {
  statusEl.textContent = enabled ? 'Provenance capture is active' : 'Provenance capture is paused'
  toggleBtn.textContent = enabled ? 'Disable' : 'Enable'
}

function updateSiteUI() {
  if (!currentHostname) return

  siteHostnameEl.textContent = currentHostname

  const override = siteSettings[currentHostname]
  const activeValue = override !== undefined ? String(override) : 'default'

  siteToggleGroup.querySelectorAll('button').forEach((btn) => {
    const val = btn.getAttribute('data-value')
    btn.classList.toggle('active', val === activeValue)
  })

  const effective = effectiveEnabled(currentHostname)
  effectiveStatusEl.textContent = `Currently: ${effective ? 'ON' : 'OFF'}`
}

function loadState() {
  chrome.storage.local.get(['enabled', 'siteSettings'], (result: Record<string, unknown>) => {
    globalEnabled = result.enabled !== false
    siteSettings = (result.siteSettings as Record<string, boolean | 'default'>) ?? {}
    updateGlobalUI(globalEnabled)
    updateSiteUI()
  })
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>) => {
  if (changes.enabled) {
    globalEnabled = changes.enabled.newValue !== false
    updateGlobalUI(globalEnabled)
    updateSiteUI()
  }
  if (changes.siteSettings) {
    siteSettings = (changes.siteSettings.newValue as Record<string, boolean | 'default'>) ?? {}
    updateSiteUI()
  }
})

// Toggle global on click
toggleBtn.addEventListener('click', () => {
  chrome.storage.local.set({ enabled: !globalEnabled })
})

// Wire per-site buttons
siteToggleGroup.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button')
  if (!btn || !currentHostname) return

  const val = btn.getAttribute('data-value')
  if (val === null) return

  const parsed: boolean | 'default' = val === 'true' ? true : val === 'false' ? false : 'default'

  const updated = { ...siteSettings, [currentHostname]: parsed }
  chrome.storage.local.set({ siteSettings: updated })
})

// Query active tab to get hostname
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0]
  if (!tab?.url || isRestrictedUrl(tab.url)) {
    siteControls.style.display = 'none'
    loadState()
    return
  }

  try {
    currentHostname = new URL(tab.url).hostname
  } catch {
    siteControls.style.display = 'none'
  }

  loadState()
})
