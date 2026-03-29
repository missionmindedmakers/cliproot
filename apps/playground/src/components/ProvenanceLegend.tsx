const LEGEND_ITEMS = [
  { label: 'Human', colorClass: 'bg-blue-500' },
  { label: 'AI Generated', colorClass: 'bg-purple-500' },
  { label: 'AI Assisted', colorClass: 'bg-violet-500' },
  { label: 'External', colorClass: 'bg-amber-500' },
  { label: 'Unknown', colorClass: 'bg-gray-500' },
]

export function ProvenanceLegend() {
  return (
    <div className="flex items-center gap-4 border-b border-gray-800 px-4 py-1.5 text-xs text-gray-400">
      <span className="font-medium text-gray-500">Provenance</span>
      {LEGEND_ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-1">
          <span className={`inline-block h-0.5 w-3 rounded ${item.colorClass}`} />
          {item.label}
        </span>
      ))}
    </div>
  )
}
