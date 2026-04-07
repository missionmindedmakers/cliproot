import type { RegistryStatusResponse } from '../../types'

export function renderRegistrySection(container: HTMLElement) {
  container.innerHTML = `
    <h2>Registry</h2>
    <div class="registry-status" id="registry-status">Checking connection...</div>
    <div class="registry-url-row">
      <input type="text" id="registry-url" placeholder="https://registry.cliproot.com" />
      <button id="registry-connect-btn">Connect</button>
    </div>
    <div id="registry-connected" style="display:none">
      <div class="registry-user" id="registry-user-info"></div>
      <label class="toggle-row">
        <span>Auto-sync new clips to registry</span>
        <input type="checkbox" id="registry-auto-sync" />
      </label>
      <div class="registry-actions">
        <button id="registry-sync-btn">Sync now</button>
        <button id="registry-login-btn">Sign in</button>
        <button id="registry-disconnect-btn" class="danger">Disconnect</button>
      </div>
      <div id="registry-sync-feedback" class="registry-feedback"></div>
    </div>
  `

  const urlInput = container.querySelector('#registry-url') as HTMLInputElement
  const connectBtn = container.querySelector('#registry-connect-btn') as HTMLButtonElement
  const connectedSection = container.querySelector('#registry-connected') as HTMLDivElement
  const statusEl = container.querySelector('#registry-status') as HTMLDivElement
  const userInfoEl = container.querySelector('#registry-user-info') as HTMLDivElement
  const autoSyncToggle = container.querySelector('#registry-auto-sync') as HTMLInputElement
  const syncBtn = container.querySelector('#registry-sync-btn') as HTMLButtonElement
  const loginBtn = container.querySelector('#registry-login-btn') as HTMLButtonElement
  const disconnectBtn = container.querySelector('#registry-disconnect-btn') as HTMLButtonElement
  const feedbackEl = container.querySelector('#registry-sync-feedback') as HTMLDivElement

  function updateUI(status: RegistryStatusResponse) {
    if (status.connected) {
      urlInput.value = status.registryUrl ?? ''
      urlInput.disabled = true
      connectBtn.style.display = 'none'
      connectedSection.style.display = ''
      statusEl.textContent = 'Connected'
      statusEl.className = 'registry-status connected'

      if (status.user) {
        userInfoEl.textContent = `Signed in as ${status.user.name || status.user.email}`
        loginBtn.style.display = 'none'
      } else {
        userInfoEl.textContent = 'Not signed in'
        loginBtn.style.display = ''
      }

      autoSyncToggle.checked = status.autoSync
    } else {
      urlInput.disabled = false
      connectBtn.style.display = ''
      connectedSection.style.display = 'none'
      statusEl.textContent = 'Not connected'
      statusEl.className = 'registry-status disconnected'
    }
  }

  function refreshStatus() {
    chrome.runtime.sendMessage({ type: 'registry-status' }, (response: RegistryStatusResponse) => {
      if (response) updateUI(response)
    })
  }

  connectBtn.addEventListener('click', () => {
    const url = urlInput.value.trim()
    if (!url) return
    connectBtn.disabled = true
    connectBtn.textContent = 'Connecting...'
    chrome.runtime.sendMessage(
      { type: 'registry-connect', url },
      (response: { ok: boolean; error?: string }) => {
        connectBtn.disabled = false
        connectBtn.textContent = 'Connect'
        if (response?.ok) {
          refreshStatus()
        } else {
          statusEl.textContent = response?.error ?? 'Connection failed'
          statusEl.className = 'registry-status error'
        }
      }
    )
  })

  disconnectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'registry-disconnect' }, () => {
      refreshStatus()
    })
  })

  loginBtn.addEventListener('click', () => {
    loginBtn.disabled = true
    loginBtn.textContent = 'Signing in...'
    chrome.runtime.sendMessage(
      { type: 'registry-login' },
      (response: { ok: boolean; error?: string }) => {
        loginBtn.disabled = false
        loginBtn.textContent = 'Sign in'
        if (response?.ok) {
          refreshStatus()
        } else {
          feedbackEl.textContent = response?.error ?? 'Login failed'
        }
      }
    )
  })

  syncBtn.addEventListener('click', () => {
    syncBtn.disabled = true
    syncBtn.textContent = 'Syncing...'
    feedbackEl.textContent = ''
    chrome.runtime.sendMessage(
      { type: 'registry-sync' },
      (response: { ok: boolean; accepted?: number; error?: string }) => {
        syncBtn.disabled = false
        syncBtn.textContent = 'Sync now'
        if (response?.ok) {
          feedbackEl.textContent = `Synced ${response.accepted ?? 0} clips`
        } else {
          feedbackEl.textContent = response?.error ?? 'Sync failed'
        }
        setTimeout(() => {
          feedbackEl.textContent = ''
        }, 3000)
      }
    )
  })

  autoSyncToggle.addEventListener('change', () => {
    chrome.storage.local.set({ registryAutoSync: autoSyncToggle.checked })
  })

  // Listen for storage changes to refresh UI
  chrome.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>) => {
    if (changes.registryUrl || changes.registryToken || changes.registryUser || changes.registryAutoSync) {
      refreshStatus()
    }
  })

  // Load initial state
  chrome.storage.local.get('registryUrl', (result: Record<string, unknown>) => {
    if (result['registryUrl']) {
      urlInput.value = result['registryUrl'] as string
    }
    refreshStatus()
  })
}
