'use client'

interface HistorySidebarProps {
  history: { id: string; original_query: string; created_at: string }[]
  show: boolean
  onClose: () => void
}

export default function HistorySidebar({ history, show, onClose }: HistorySidebarProps) {
  if (!show) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={onClose} />

      <aside className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-gray-200 bg-gray-50 md:relative md:z-auto">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">History</h2>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-white">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {history.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-500">No queries yet</p>
          ) : (
            <div className="space-y-0.5">
              {history.map((item) => (
                <button
                  key={item.id}
                  className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-white"
                >
                  <p className="truncate text-sm text-gray-900">{item.original_query}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
