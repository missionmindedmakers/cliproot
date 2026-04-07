import { useRef, useState } from 'react'
import type { CrpBundle } from '@cliproot/protocol'
import { validateBundle } from '@cliproot/protocol'
import { useBundleStore } from '../hooks/useBundleStore'
import { useRegistryStore } from '../hooks/useRegistryStore'
import { readCliprootFromPasteEvent } from '../lib/clipboard-read'
import { isFsaSupported, openCliprootDirectory, readBundlesFromFileList } from '../lib/fsa-reader'
import { RegistryDialog } from './RegistryDialog'

export function Toolbar() {
  const addBundle = useBundleStore((s) => s.addBundle)
  const addBundles = useBundleStore((s) => s.addBundles)
  const clearAll = useBundleStore((s) => s.clearAll)
  const bundleCount = useBundleStore((s) => s.bundles.size)
  const [error, setError] = useState<string | null>(null)
  const [showRegistry, setShowRegistry] = useState(false)
  const isRegistryConnected = useRegistryStore((s) => s.isConnected)

  const uploadRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const handlePasteEvent = (e: React.ClipboardEvent) => {
    e.preventDefault()
    setError(null)
    const result = readCliprootFromPasteEvent(e.nativeEvent)
    if (result.bundle) {
      addBundle(`clipboard-${Date.now()}`, result.bundle)
    } else if (result.error) {
      setError(result.error)
    }
  }

  const handleOpenFolder = async () => {
    setError(null)
    try {
      const { bundles, errors } = await openCliprootDirectory()
      if (bundles.length > 0) {
        addBundles(bundles)
      }
      if (errors.length > 0 && bundles.length === 0) {
        setError(errors.join('\n'))
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleFolderFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const files = e.target.files
    if (!files || files.length === 0) return

    const { bundles, errors } = await readBundlesFromFileList(files)
    if (bundles.length > 0) {
      addBundles(bundles)
    }
    if (errors.length > 0 && bundles.length === 0) {
      setError(errors.join('\n'))
    }
    e.target.value = ''
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const files = e.target.files
    if (!files) return

    for (const file of files) {
      try {
        const text = await file.text()
        const parsed: unknown = JSON.parse(text)
        const result = validateBundle(parsed)
        if (result.ok) {
          addBundle(file.name, result.value as CrpBundle)
        } else {
          setError(`${file.name}: validation failed`)
        }
      } catch (err) {
        setError(`${file.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {isFsaSupported() ? (
          <button
            onClick={handleOpenFolder}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 transition-colors"
          >
            Open Folder
          </button>
        ) : (
          <>
            <button
              onClick={() => folderRef.current?.click()}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 transition-colors"
            >
              Open Folder
            </button>
            <input
              ref={folderRef}
              type="file"
              // @ts-expect-error -- webkitdirectory is non-standard
              webkitdirectory=""
              className="hidden"
              onChange={handleFolderFallback}
            />
          </>
        )}

        <button
          onClick={() => uploadRef.current?.click()}
          className="rounded bg-gray-700 px-3 py-1.5 text-sm font-medium hover:bg-gray-600 transition-colors"
        >
          Upload JSON
        </button>
        <input
          ref={uploadRef}
          type="file"
          accept=".json"
          multiple
          className="hidden"
          onChange={handleUpload}
        />

        <button
          onClick={() => setShowRegistry(true)}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
            isRegistryConnected
              ? 'bg-indigo-700 hover:bg-indigo-600'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {isRegistryConnected ? 'Registry \u2713' : 'Registry'}
        </button>

        {bundleCount > 0 && (
          <button
            onClick={clearAll}
            className="rounded bg-red-800/60 px-3 py-1.5 text-sm font-medium hover:bg-red-700/60 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="relative rounded border border-dashed border-gray-600 focus-within:border-indigo-500">
        <div
          contentEditable
          onPaste={handlePasteEvent}
          onBeforeInput={(e) => e.preventDefault()}
          className="px-3 py-2 text-sm focus:outline-none cursor-text min-h-8"
          role="textbox"
          aria-label="Paste area"
          suppressContentEditableWarning
        />
        <span className="absolute inset-0 flex items-center px-3 py-2 text-sm text-gray-400 pointer-events-none select-none">
          Paste here (Ctrl+V)
        </span>
      </div>

      {error && (
        <div className="rounded bg-red-900/40 border border-red-700/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <RegistryDialog open={showRegistry} onClose={() => setShowRegistry(false)} />
    </div>
  )
}
