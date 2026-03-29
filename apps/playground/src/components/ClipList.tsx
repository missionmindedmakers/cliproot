import { useBundleStore } from '../hooks/useBundleStore'
import { SourceBadge } from './Badge'

export function ClipList() {
  const clips = useBundleStore((s) => s.clips)
  const selectedClipHash = useBundleStore((s) => s.selectedClipHash)
  const selectClip = useBundleStore((s) => s.selectClip)
  const view = useBundleStore((s) => s.view)
  const insertClipIntoEditor = useBundleStore((s) => s.insertClipIntoEditor)

  if (clips.size === 0) return null

  const isEditorActive = view === 'editor' && insertClipIntoEditor !== null
  const clipArray = Array.from(clips.values())

  return (
    <div className="space-y-1">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Clips ({clips.size})
      </h2>
      <div className="space-y-0.5">
        {clipArray.map((clip) => {
          const isSelected = selectedClipHash === clip.clipHash
          const preview = clip.content ?? clip.selectors?.textQuote?.exact ?? '(no content)'
          const sourceType = clip.resolvedSources[0]?.sourceType
          const sourceUri = clip.resolvedSources[0]?.sourceUri
          const hasContent = !!(clip.content ?? clip.selectors?.textQuote?.exact)

          return (
            <div
              key={clip.clipHash}
              className={`rounded text-sm transition-colors ${
                isSelected ? 'bg-indigo-900/50 ring-1 ring-indigo-500/50' : 'hover:bg-gray-800/50'
              }`}
            >
              <button
                onClick={() => selectClip(clip.clipHash)}
                className="w-full text-left px-2 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <code className="shrink-0 text-xs text-gray-500">{clip.clipHash.slice(7, 19)}</code>
                  {sourceType && <SourceBadge type={sourceType} />}
                </div>
                <p className="mt-0.5 truncate text-gray-300">{preview}</p>
                {sourceUri && <p className="truncate text-xs text-gray-600">{sourceUri}</p>}
              </button>
              {isEditorActive && hasContent && (
                <div className="px-2 pb-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      insertClipIntoEditor(clip.clipHash)
                    }}
                    className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300 hover:bg-gray-600 transition-colors"
                  >
                    Insert into editor
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
