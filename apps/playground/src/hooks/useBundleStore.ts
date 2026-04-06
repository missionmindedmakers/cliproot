import type { CrpBundle } from '@cliproot/protocol'
import { create } from 'zustand'
import {
  mergeBundles,
  type MergedClip,
  type MergedEdge,
  type MergedState,
  type ResolvedAgent,
  type ResolvedActivity,
  type ResolvedDocument,
  type ResolvedSource
} from '../lib/bundle-merge'

interface BundleStore {
  /** Raw bundles keyed by source identifier (filename, "clipboard-<ts>", etc.) */
  bundles: Map<string, CrpBundle>

  /** Merged state derived from all loaded bundles */
  clips: Map<string, MergedClip>
  edges: MergedEdge[]
  agents: Map<string, ResolvedAgent>
  sources: Map<string, ResolvedSource>
  activities: Map<string, ResolvedActivity>
  documents: Map<string, ResolvedDocument>

  /** Currently selected clip hash */
  selectedClipHash: string | null

  /** View mode for the main panel */
  view: 'detail' | 'dag' | 'editor' | 'raw'

  /**
   * Callback registered by ClipEditor when mounted.
   * Inserts a clip's content into the editor at the cursor with attribution.
   */
  insertClipIntoEditor: ((clipHash: string) => void) | null

  /** Actions */
  addBundle: (key: string, bundle: CrpBundle) => void
  addBundles: (entries: [string, CrpBundle][]) => void
  removeBundle: (key: string) => void
  selectClip: (hash: string | null) => void
  setView: (view: 'detail' | 'dag' | 'editor' | 'raw') => void
  setInsertClipHandler: (handler: ((clipHash: string) => void) | null) => void
  clearAll: () => void
}

function emptyMerged(): MergedState {
  return {
    clips: new Map(),
    edges: [],
    agents: new Map(),
    sources: new Map(),
    activities: new Map(),
    documents: new Map()
  }
}

function remerge(bundles: Map<string, CrpBundle>) {
  if (bundles.size === 0) return emptyMerged()
  return mergeBundles(bundles)
}

export const useBundleStore = create<BundleStore>((set) => ({
  bundles: new Map(),
  ...emptyMerged(),
  selectedClipHash: null,
  view: 'detail',
  insertClipIntoEditor: null,

  addBundle: (key, bundle) =>
    set((state) => {
      const bundles = new Map(state.bundles)
      bundles.set(key, bundle)
      return { bundles, ...remerge(bundles) }
    }),

  addBundles: (entries) =>
    set((state) => {
      const bundles = new Map(state.bundles)
      for (const [key, bundle] of entries) {
        bundles.set(key, bundle)
      }
      return { bundles, ...remerge(bundles) }
    }),

  removeBundle: (key) =>
    set((state) => {
      const bundles = new Map(state.bundles)
      bundles.delete(key)
      return { bundles, ...remerge(bundles) }
    }),

  selectClip: (hash) => set({ selectedClipHash: hash }),

  setView: (view) => set({ view }),

  setInsertClipHandler: (handler) => set({ insertClipIntoEditor: handler }),

  clearAll: () =>
    set({
      bundles: new Map(),
      ...emptyMerged(),
      selectedClipHash: null
    })
}))
