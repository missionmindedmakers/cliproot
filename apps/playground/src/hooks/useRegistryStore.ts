import { create } from 'zustand'
import {
  RegistryClient,
  LocalStorageTokenStore,
  type ProjectSummary,
  type ProjectDetail,
  type SearchResult,
  type SessionUser,
} from '@cliproot/registry-client'
import type { CrpBundle } from '@cliproot/protocol'
import { validateBundle } from '@cliproot/protocol'
import { useBundleStore } from './useBundleStore'

interface RegistryStore {
  registryUrl: string | null
  isConnected: boolean
  isConnecting: boolean
  user: SessionUser | null
  error: string | null

  projects: ProjectSummary[]
  projectsCursor: string | null
  isLoadingProjects: boolean
  selectedProject: ProjectDetail | null

  connect: (url: string) => Promise<void>
  disconnect: () => Promise<void>
  login: () => void
  checkAuth: () => Promise<void>
  loadProjects: (cursor?: string) => Promise<void>
  selectProject: (owner: string, name: string) => Promise<void>
  loadProjectClips: (owner: string, name: string) => Promise<void>
  publishBundles: (project: string) => Promise<number>
  search: (query: string) => Promise<SearchResult[]>
}

const tokenStorage = new LocalStorageTokenStore()
const client = new RegistryClient({ tokenStore: tokenStorage })

export const useRegistryStore = create<RegistryStore>((set, get) => ({
  registryUrl: localStorage.getItem('cliproot:registryUrl'),
  isConnected: !!localStorage.getItem('cliproot:registryUrl'),
  isConnecting: false,
  user: null,
  error: null,

  projects: [],
  projectsCursor: null,
  isLoadingProjects: false,
  selectedProject: null,

  connect: async (url: string) => {
    set({ isConnecting: true, error: null })
    try {
      await client.connect(url)
      set({ registryUrl: url, isConnected: true, isConnecting: false })
      // Check if already authenticated
      await get().checkAuth()
    } catch (err) {
      set({
        isConnecting: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  disconnect: async () => {
    await client.disconnect()
    set({
      registryUrl: null,
      isConnected: false,
      user: null,
      projects: [],
      projectsCursor: null,
      selectedProject: null,
      error: null,
    })
  },

  login: () => {
    const { registryUrl } = get()
    if (!registryUrl) return
    const callbackUrl = window.location.origin + window.location.pathname + '?auth=callback'
    const authUrl = `${registryUrl}/api/auth/sign-in/email?callbackURL=${encodeURIComponent(callbackUrl)}`
    window.open(authUrl, '_blank', 'width=500,height=600')
  },

  checkAuth: async () => {
    try {
      const session = await client.checkAuth()
      if (session.valid && session.user) {
        set({ user: session.user })
      } else {
        set({ user: null })
      }
    } catch {
      set({ user: null })
    }
  },

  loadProjects: async (cursor?: string) => {
    set({ isLoadingProjects: true, error: null })
    try {
      const result = await client.listProjects({ cursor, limit: 20 })
      set((state) => ({
        projects: cursor ? [...state.projects, ...result.projects] : result.projects,
        projectsCursor: result.cursor,
        isLoadingProjects: false,
      }))
    } catch (err) {
      set({
        isLoadingProjects: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  selectProject: async (owner: string, name: string) => {
    try {
      const detail = await client.getProject(owner, name)
      set({ selectedProject: detail })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  loadProjectClips: async (owner: string, name: string) => {
    set({ error: null })
    try {
      // Get project detail to find clip hashes
      const detail = await client.getProject(owner, name)
      // List all clips via search scoped to this project
      const searchResult = await client.search({ q: '*', project: name, owner, limit: 100 })

      const entries: [string, CrpBundle][] = []
      for (const result of searchResult.results) {
        try {
          const bundle = await client.downloadClipBundle(result.clipHash)
          const validated = validateBundle(bundle)
          if (validated.ok) {
            entries.push([`registry-${result.clipHash}`, validated.value as CrpBundle])
          }
        } catch {
          // Skip individual failed downloads
        }
      }

      if (entries.length > 0) {
        useBundleStore.getState().addBundles(entries)
      }

      set({ selectedProject: detail })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  publishBundles: async (project: string) => {
    set({ error: null })
    try {
      const bundles = useBundleStore.getState().bundles
      const bundleArray = Array.from(bundles.values())
      if (bundleArray.length === 0) return 0

      const result = await client.publishClips({ project, bundles: bundleArray })
      return result.accepted
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
      return 0
    }
  },

  search: async (query: string) => {
    try {
      const result = await client.search({ q: query })
      return result.results
    } catch {
      return []
    }
  },
}))
