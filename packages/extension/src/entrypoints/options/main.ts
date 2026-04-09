import type { SiteSettings } from '../../types'

const globalToggle = document.getElementById('global-toggle') as HTMLInputElement
const highlightsToggle = document.getElementById('highlights-toggle') as HTMLInputElement
const siteList = document.getElementById('site-list')!
const addHostname = document.getElementById('add-hostname') as HTMLInputElement
const addValue = document.getElementById('add-value') as HTMLSelectElement
const addBtn = document.getElementById('add-btn')!
const clearAllBtn = document.getElementById('clear-all')!

let siteSettings: SiteSettings = {}

function renderSites() {
  siteList.innerHTML = ''

  const hostnames = Object.keys(siteSettings).sort()
  if (hostnames.length === 0) {
    siteList.innerHTML = '<p class="empty">No per-site overrides configured.</p>'
    return
  }

  for (const hostname of hostnames) {
    const value = siteSettings[hostname]
    if (value === 'default') continue

    const row = document.createElement('div')
    row.className = 'site-row'

    const label = document.createElement('span')
    label.className = 'site-hostname'
    label.textContent = hostname

    const status = document.createElement('span')
    status.className = `site-status ${value ? 'enabled' : 'disabled'}`
    status.textContent = value ? 'Enabled' : 'Disabled'

    const toggleBtn = document.createElement('button')
    toggleBtn.className = 'site-toggle'
    toggleBtn.textContent = value ? 'Disable' : 'Enable'
    toggleBtn.addEventListener('click', () => {
      siteSettings[hostname] = !value
      chrome.storage.local.set({ siteSettings })
    })

    const removeBtn = document.createElement('button')
    removeBtn.className = 'site-remove'
    removeBtn.textContent = 'Remove'
    removeBtn.addEventListener('click', () => {
      delete siteSettings[hostname]
      chrome.storage.local.set({ siteSettings })
    })

    row.append(label, status, toggleBtn, removeBtn)
    siteList.appendChild(row)
  }
}

function loadState() {
  chrome.storage.local.get(
    ['enabled', 'highlightsEnabled', 'siteSettings'],
    (result: Record<string, unknown>) => {
      globalToggle.checked = result.enabled !== false
      highlightsToggle.checked = result.highlightsEnabled !== false
      siteSettings = (result.siteSettings as SiteSettings) ?? {}
      renderSites()
    }
  )
}

globalToggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: globalToggle.checked })
})

highlightsToggle.addEventListener('change', () => {
  chrome.storage.local.set({ highlightsEnabled: highlightsToggle.checked })
})

addBtn.addEventListener('click', () => {
  const hostname = addHostname.value.trim().toLowerCase()
  if (!hostname) return

  const value = addValue.value === 'true'
  siteSettings[hostname] = value
  chrome.storage.local.set({ siteSettings })
  addHostname.value = ''
})

clearAllBtn.addEventListener('click', () => {
  siteSettings = {}
  chrome.storage.local.set({ siteSettings })
})

chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>) => {
  if (changes.enabled) {
    globalToggle.checked = changes.enabled.newValue !== false
  }
  if (changes.highlightsEnabled) {
    highlightsToggle.checked = changes.highlightsEnabled.newValue !== false
  }
  if (changes.siteSettings) {
    siteSettings = (changes.siteSettings.newValue as SiteSettings) ?? {}
    renderSites()
  }
})

loadState()
