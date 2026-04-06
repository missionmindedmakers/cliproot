import { useState } from 'react'
import { useBundleStore } from '../hooks/useBundleStore'

export function RawJson() {
  const bundles = useBundleStore((s) => s.bundles)
  const [copied, setCopied] = useState<string | null>(null)

  if (bundles.size === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 text-sm">
        No bundles loaded. Paste a clip to see its raw JSON.
      </div>
    )
  }

  const handleCopy = (key: string, json: string) => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {Array.from(bundles.entries()).map(([key, bundle]) => {
        const json = JSON.stringify(bundle, null, 2)
        return (
          <details key={key} open className="group rounded border border-gray-700 bg-gray-900">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm select-none hover:bg-gray-800">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-gray-300 truncate">{key}</span>
                <span className="shrink-0 rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-400">
                  {bundle.bundleType}
                </span>
                {bundle.createdAt && (
                  <span className="shrink-0 text-xs text-gray-500">{bundle.createdAt}</span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  handleCopy(key, json)
                }}
                className="shrink-0 rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
              >
                {copied === key ? 'Copied!' : 'Copy'}
              </button>
            </summary>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-green-300 whitespace-pre">
              {json}
            </pre>
          </details>
        )
      })}
    </div>
  )
}
