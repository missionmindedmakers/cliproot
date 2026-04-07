import { useRegistryStore } from '../hooks/useRegistryStore'

export function RegistryProjectBrowser() {
  const projects = useRegistryStore((s) => s.projects)
  const projectsCursor = useRegistryStore((s) => s.projectsCursor)
  const isLoadingProjects = useRegistryStore((s) => s.isLoadingProjects)
  const loadProjects = useRegistryStore((s) => s.loadProjects)
  const loadProjectClips = useRegistryStore((s) => s.loadProjectClips)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Projects</h3>
        <button
          onClick={() => loadProjects()}
          disabled={isLoadingProjects}
          className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600 disabled:opacity-50"
        >
          {isLoadingProjects ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {projects.length === 0 && !isLoadingProjects && (
        <p className="text-xs text-gray-500">No projects found. Click Refresh to load.</p>
      )}

      <ul className="space-y-1">
        {projects.map((p) => (
          <li key={`${p.owner}/${p.name}`}>
            <button
              onClick={() => loadProjectClips(p.owner, p.name)}
              className="w-full rounded bg-gray-800 px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors"
            >
              <div className="font-medium text-gray-200">
                {p.owner}/{p.name}
              </div>
              <div className="text-xs text-gray-500">
                {p.clipCount} clips · {new Date(p.lastPublishedAt).toLocaleDateString()}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {projectsCursor && (
        <button
          onClick={() => loadProjects(projectsCursor)}
          disabled={isLoadingProjects}
          className="w-full rounded bg-gray-800 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-700 disabled:opacity-50"
        >
          Load more
        </button>
      )}
    </div>
  )
}
