import type { CrpBundle } from '@cliproot/protocol'
import { validateBundle } from '@cliproot/protocol'
import { useBundleStore } from './hooks/useBundleStore'
import { Toolbar } from './components/Toolbar'
import { ClipList } from './components/ClipList'
import { ClipDetail } from './components/ClipDetail'
import { ProvenanceDag } from './components/ProvenanceDag'
import { ClipEditor } from './components/ClipEditor'
import { EmptyState } from './components/EmptyState'
import { DEMO_BUNDLE } from './lib/demo-data'

export function App() {
  const clips = useBundleStore((s) => s.clips)
  const edges = useBundleStore((s) => s.edges)
  const view = useBundleStore((s) => s.view)
  const setView = useBundleStore((s) => s.setView)
  const addBundle = useBundleStore((s) => s.addBundle)

  const hasClips = clips.size > 0
  const hasEdges = edges.length > 0

  const loadDemo = () => {
    const result = validateBundle(DEMO_BUNDLE)
    if (result.ok) {
      addBundle('demo-example', result.value as CrpBundle)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Cliproot Playground</h1>
          <div className="flex items-center gap-2">
            <div className="flex rounded bg-gray-800 text-sm">
              <button
                onClick={() => setView('detail')}
                className={`rounded-l px-3 py-1 transition-colors ${
                  view === 'detail'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Detail
              </button>
              {hasEdges && (
                <button
                  onClick={() => setView('dag')}
                  className={`px-3 py-1 transition-colors ${
                    view === 'dag' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Graph
                </button>
              )}
              <button
                onClick={() => setView('editor')}
                className={`rounded-r px-3 py-1 transition-colors ${
                  view === 'editor'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Editor
              </button>
            </div>
          </div>
        </div>
        <div className="mt-2">
          <Toolbar />
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        {hasClips ? (
          <>
            {/* Sidebar: clip list */}
            <aside className="w-80 shrink-0 overflow-y-auto border-r border-gray-800 p-3">
              <ClipList />
            </aside>

            {/* Main panel */}
            <main className="min-w-0 flex-1">
              {view === 'editor' ? (
                <ClipEditor />
              ) : view === 'dag' && hasEdges ? (
                <ProvenanceDag />
              ) : (
                <ClipDetail />
              )}
            </main>
          </>
        ) : (
          <main className="flex-1">
            <EmptyState />
            <div className="flex justify-center pb-8">
              <button
                onClick={loadDemo}
                className="rounded bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Load demo data
              </button>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}
