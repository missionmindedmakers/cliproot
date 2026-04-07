import type {
  RecentClip,
  PageSource,
  GetPageSourcesResponse,
  GenerateBibliographyResponse,
  GetClipDetailResponse,
  SearchClipsResponse,
  StoredClip,
  StoredEdge,
  RegistryStatusResponse
} from '../../types'

const statusEl = document.getElementById('status')!
const toggleBtn = document.getElementById('toggle')!
const highlightsToggle = document.getElementById('highlights-toggle') as HTMLInputElement
const siteControls = document.getElementById('site-controls')!
const siteHostnameEl = document.getElementById('site-hostname')!
const siteToggleGroup = document.getElementById('site-toggle-group')!
const effectiveStatusEl = document.getElementById('effective-status')!
const clipsList = document.getElementById('clips-list')!
const settingsLink = document.getElementById('open-settings')!
const sourcesList = document.getElementById('sources-list')!
const generateBibBtn = document.getElementById('generate-bib')!
const pageSourcesSection = document.getElementById('page-sources')!
const clipDetailSection = document.getElementById('clip-detail')!
const detailBackBtn = document.getElementById('detail-back')!
const detailContent = document.getElementById('detail-content')!
const searchInput = document.getElementById('search-input') as HTMLInputElement
const searchResults = document.getElementById('search-results')!
const recentClipsSection = document.getElementById('recent-clips')!

let currentHostname = ''
let globalEnabled = true
let siteSettings: Record<string, boolean | 'default'> = {}
let highlightsEnabled = true

function isRestrictedUrl(url: string): boolean {
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('moz-extension://') ||
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

function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function renderRecentClips(clips: RecentClip[]) {
  clipsList.innerHTML = ''

  if (clips.length === 0) {
    const li = document.createElement('li')
    li.className = 'clips-empty'
    li.textContent = 'No clips yet'
    clipsList.appendChild(li)
    return
  }

  for (const clip of clips.slice(0, 10)) {
    const li = document.createElement('li')

    const preview = document.createElement('span')
    preview.className = 'clip-preview'
    preview.textContent = clip.textPreview || '(no text)'

    const meta = document.createElement('span')
    meta.className = 'clip-meta'
    meta.textContent = `${clip.hostname} \u00b7 ${relativeTime(clip.timestamp)}`

    li.append(preview, meta)
    clipsList.appendChild(li)
  }
}

let currentTabUrl = ''

function loadPageSources(url: string) {
  chrome.runtime.sendMessage(
    { type: 'get-page-sources', url },
    (response: GetPageSourcesResponse) => {
      if (!response) return
      renderSources(response.sources)
    }
  )
}

function renderSources(sources: PageSource[]) {
  sourcesList.innerHTML = ''
  generateBibBtn.style.display = sources.length > 0 ? 'inline-block' : 'none'

  for (const source of sources) {
    const li = document.createElement('li')

    const hostname = document.createElement('span')
    hostname.className = 'source-hostname'
    hostname.textContent = source.title || source.hostname

    const count = document.createElement('span')
    count.className = 'source-count'
    count.textContent = `(${source.clipCount} clip${source.clipCount !== 1 ? 's' : ''})`

    li.append(hostname, count)
    li.addEventListener('click', () => {
      if (source.clips.length > 0) {
        showClipDetail(source.clips[0].clipHash)
      }
    })
    sourcesList.appendChild(li)
  }
}

function generateBibliography() {
  chrome.runtime.sendMessage(
    { type: 'generate-bibliography', url: currentTabUrl, format: 'markdown' },
    (response: GenerateBibliographyResponse) => {
      if (!response || response.sourceCount === 0) return
      navigator.clipboard.writeText(response.text).then(() => {
        const feedback = document.createElement('span')
        feedback.className = 'bib-feedback'
        feedback.textContent = 'Copied!'
        generateBibBtn.after(feedback)
        setTimeout(() => feedback.remove(), 2000)
      })
    }
  )
}

function showClipDetail(clipHash: string) {
  chrome.runtime.sendMessage(
    { type: 'get-clip-detail', clipHash },
    (response: GetClipDetailResponse) => {
      if (!response || !response.clip) return
      renderClipDetail(response.clip as StoredClip, response.edges as StoredEdge[])
    }
  )
}

function renderClipDetail(clip: StoredClip, edges: StoredEdge[]) {
  // Hide main sections, show detail
  recentClipsSection.style.display = 'none'
  pageSourcesSection.style.display = 'none'
  document.getElementById('clip-search')!.style.display = 'none'
  clipDetailSection.style.display = 'block'

  detailContent.innerHTML = ''

  // Source info
  const sourceField = createDetailField('Source', `${clip.documentId}`)
  detailContent.appendChild(sourceField)

  // Full text
  const textField = createDetailField('Text', clip.content)
  detailContent.appendChild(textField)

  // Timestamp
  const timeField = createDetailField('Copied', new Date(clip.createdAt).toLocaleString())
  detailContent.appendChild(timeField)

  // Derivation edges
  if (edges.length > 0) {
    const edgeField = document.createElement('div')
    edgeField.className = 'detail-field'

    const label = document.createElement('div')
    label.className = 'detail-label'
    label.textContent = `${edges.length} derivation${edges.length !== 1 ? 's' : ''}`
    edgeField.appendChild(label)

    const list = document.createElement('ul')
    list.className = 'detail-paste-list'
    for (const edge of edges) {
      const li = document.createElement('li')
      li.textContent = `${edge.transformationType} \u00b7 ${relativeTime(new Date(edge.createdAt).getTime())}`
      list.appendChild(li)
    }
    edgeField.appendChild(list)
    detailContent.appendChild(edgeField)
  }
}

function createDetailField(label: string, text: string): HTMLElement {
  const field = document.createElement('div')
  field.className = 'detail-field'

  const labelEl = document.createElement('div')
  labelEl.className = 'detail-label'
  labelEl.textContent = label

  const textEl = document.createElement('div')
  textEl.className = 'detail-text'
  textEl.textContent = text

  field.append(labelEl, textEl)
  return field
}

function hideClipDetail() {
  clipDetailSection.style.display = 'none'
  recentClipsSection.style.display = ''
  pageSourcesSection.style.display = ''
  document.getElementById('clip-search')!.style.display = ''
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null

function handleSearchInput() {
  const query = searchInput.value.trim()
  if (searchDebounce) clearTimeout(searchDebounce)

  if (!query) {
    searchResults.innerHTML = ''
    return
  }

  searchDebounce = setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'search-clips', query }, (response: SearchClipsResponse) => {
      if (!response) return
      renderSearchResults(response.clips as StoredClip[])
    })
  }, 300)
}

function renderSearchResults(clips: StoredClip[]) {
  searchResults.innerHTML = ''

  if (clips.length === 0) {
    const li = document.createElement('li')
    li.textContent = 'No results'
    li.style.color = '#999'
    li.style.cursor = 'default'
    searchResults.appendChild(li)
    return
  }

  for (const clip of clips.slice(0, 20)) {
    const li = document.createElement('li')

    const preview = document.createElement('span')
    preview.className = 'clip-preview'
    preview.textContent = clip.content.slice(0, 100) || '(no text)'

    const meta = document.createElement('span')
    meta.className = 'clip-meta'
    meta.textContent = `${clip.documentId} \u00b7 ${relativeTime(new Date(clip.createdAt).getTime())}`

    li.append(preview, meta)
    li.addEventListener('click', () => {
      showClipDetail(clip.clipHash)
    })
    searchResults.appendChild(li)
  }
}

// Wire event handlers
generateBibBtn.addEventListener('click', generateBibliography)
detailBackBtn.addEventListener('click', hideClipDetail)
searchInput.addEventListener('input', handleSearchInput)

function loadState() {
  chrome.storage.local.get(
    ['enabled', 'highlightsEnabled', 'siteSettings', 'recentClips'],
    (result: Record<string, unknown>) => {
      globalEnabled = result.enabled !== false
      highlightsEnabled = result.highlightsEnabled !== false
      siteSettings = (result.siteSettings as Record<string, boolean | 'default'>) ?? {}
      highlightsToggle.checked = highlightsEnabled
      updateGlobalUI(globalEnabled)
      updateSiteUI()
      renderRecentClips((result.recentClips as RecentClip[]) ?? [])
    }
  )
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>) => {
  if (changes.enabled) {
    globalEnabled = changes.enabled.newValue !== false
    updateGlobalUI(globalEnabled)
    updateSiteUI()
  }
  if (changes.highlightsEnabled) {
    highlightsEnabled = changes.highlightsEnabled.newValue !== false
    highlightsToggle.checked = highlightsEnabled
  }
  if (changes.siteSettings) {
    siteSettings = (changes.siteSettings.newValue as Record<string, boolean | 'default'>) ?? {}
    updateSiteUI()
  }
  if (changes.recentClips) {
    renderRecentClips((changes.recentClips.newValue as RecentClip[]) ?? [])
  }
})

// Toggle global on click
toggleBtn.addEventListener('click', () => {
  chrome.storage.local.set({ enabled: !globalEnabled })
})

// Toggle highlights
highlightsToggle.addEventListener('change', () => {
  chrome.storage.local.set({ highlightsEnabled: highlightsToggle.checked })
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

// Settings link
settingsLink.addEventListener('click', (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage()
})

// Registry sync button
const syncBtn = document.getElementById('sync-btn')!
chrome.runtime.sendMessage({ type: 'registry-status' }, (response: RegistryStatusResponse) => {
  if (response?.connected) {
    syncBtn.style.display = ''
  }
})

syncBtn.addEventListener('click', () => {
  syncBtn.textContent = 'Syncing...'
  ;(syncBtn as HTMLButtonElement).disabled = true
  chrome.runtime.sendMessage(
    { type: 'registry-sync' },
    (response: { ok: boolean; accepted?: number }) => {
      ;(syncBtn as HTMLButtonElement).disabled = false
      syncBtn.textContent = response?.ok ? `Synced ${response.accepted ?? 0}` : 'Failed'
      setTimeout(() => {
        syncBtn.textContent = 'Sync'
      }, 2000)
    }
  )
})

chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>) => {
  if (changes.registryToken || changes.registryUrl) {
    chrome.runtime.sendMessage({ type: 'registry-status' }, (response: RegistryStatusResponse) => {
      syncBtn.style.display = response?.connected ? '' : 'none'
    })
  }
})

// Query active tab to get hostname
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0]
  if (!tab?.url || isRestrictedUrl(tab.url)) {
    siteControls.style.display = 'none'
    pageSourcesSection.style.display = 'none'
    loadState()
    return
  }

  try {
    currentHostname = new URL(tab.url).hostname
    currentTabUrl = tab.url
  } catch {
    siteControls.style.display = 'none'
  }

  loadState()
  if (currentTabUrl) {
    loadPageSources(currentTabUrl)
  }
})
