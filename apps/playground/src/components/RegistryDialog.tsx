import { useState } from 'react'
import { useRegistryStore } from '../hooks/useRegistryStore'
import { RegistryProjectBrowser } from './RegistryProjectBrowser'

interface RegistryDialogProps {
  open: boolean
  onClose: () => void
}

export function RegistryDialog({ open, onClose }: RegistryDialogProps) {
  const isConnected = useRegistryStore((s) => s.isConnected)
  const isConnecting = useRegistryStore((s) => s.isConnecting)
  const user = useRegistryStore((s) => s.user)
  const error = useRegistryStore((s) => s.error)
  const connect = useRegistryStore((s) => s.connect)
  const disconnect = useRegistryStore((s) => s.disconnect)
  const login = useRegistryStore((s) => s.login)
  const publishBundles = useRegistryStore((s) => s.publishBundles)

  const [urlInput, setUrlInput] = useState(
    useRegistryStore.getState().registryUrl ?? '',
  )
  const [projectName, setProjectName] = useState('')
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null)

  if (!open) return null

  const handleConnect = async () => {
    if (!urlInput.trim()) return
    await connect(urlInput.trim())
  }

  const handlePublish = async () => {
    if (!projectName.trim()) return
    setPublishFeedback(null)
    const accepted = await publishBundles(projectName.trim())
    setPublishFeedback(`Published ${accepted} clips`)
    setTimeout(() => setPublishFeedback(null), 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Registry</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {!isConnected ? (
          <div className="space-y-3">
            <label className="block text-sm text-gray-400">Registry URL</label>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://registry.cliproot.com"
              className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConnect()
              }}
            />
            <button
              onClick={handleConnect}
              disabled={isConnecting || !urlInput.trim()}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connection info */}
            <div className="flex items-center justify-between rounded bg-gray-800 px-3 py-2">
              <div className="text-sm">
                <span className="text-gray-400">Connected to </span>
                <span className="text-gray-200">{useRegistryStore.getState().registryUrl}</span>
              </div>
              <button
                onClick={disconnect}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Disconnect
              </button>
            </div>

            {/* Auth */}
            {user ? (
              <div className="text-sm text-gray-400">
                Signed in as <span className="text-gray-200">{user.name || user.email}</span>
              </div>
            ) : (
              <button
                onClick={login}
                className="rounded bg-gray-700 px-3 py-1.5 text-sm hover:bg-gray-600 transition-colors"
              >
                Sign in
              </button>
            )}

            {/* Project browser */}
            <RegistryProjectBrowser />

            {/* Publish */}
            <div className="border-t border-gray-700 pt-3 space-y-2">
              <h3 className="text-sm font-medium text-gray-300">Publish loaded bundles</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                  className="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={handlePublish}
                  disabled={!projectName.trim() || !user}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  Publish
                </button>
              </div>
              {publishFeedback && (
                <p className="text-xs text-emerald-400">{publishFeedback}</p>
              )}
              {!user && (
                <p className="text-xs text-gray-500">Sign in to publish</p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded bg-red-900/40 border border-red-700/50 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
