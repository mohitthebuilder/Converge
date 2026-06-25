'use client'

import { useState } from 'react'

interface HistorySidebarProps {
  history: { id: string; original_query: string; created_at: string }[]
  show: boolean
  onClose: () => void
  onSelectQuery: (queryId: string) => void
  onDeleteQuery: (queryId: string) => void
}

export default function HistorySidebar({ history, show, onClose, onSelectQuery, onDeleteQuery }: HistorySidebarProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (!show) return null

  function handleDelete(id: string) {
    if (confirmId === id) {
      setDeletingId(id)
      onDeleteQuery(id)
      setConfirmId(null)
    } else {
      setConfirmId(id)
      setTimeout(() => setConfirmId((prev) => (prev === id ? null : prev)), 3000)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={onClose} />

      <aside className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-gray-200 bg-gray-50 md:relative md:z-auto">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">History</h2>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 text-gray-500 hover:bg-white">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {history.length === 0 ? (
            <p className="p-4 text-center text-sm text-gray-500">No queries yet</p>
          ) : (
            <div className="divide-y divide-gray-200/70">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`group relative flex items-start transition-colors hover:bg-white ${deletingId === item.id ? 'opacity-40' : ''}`}
                >
                  <button
                    onClick={() => onSelectQuery(item.id)}
                    className="w-full cursor-pointer px-3 py-2 text-left"
                  >
                    <p className="truncate pr-6 text-sm text-gray-900">{item.original_query}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </button>
                  {confirmId === item.id ? (
                    <div className="absolute right-1.5 top-2 flex items-center gap-0.5">
                      <span className="mr-1 text-[10px] text-gray-500">Delete?</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                        className="cursor-pointer rounded p-0.5 text-emerald-500 transition-colors hover:bg-emerald-50"
                        title="Confirm delete"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmId(null) }}
                        className="cursor-pointer rounded p-0.5 text-red-400 transition-colors hover:bg-red-50"
                        title="Cancel"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                      className="absolute right-2 top-2.5 cursor-pointer rounded p-0.5 text-gray-400 opacity-0 transition-all hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
                      title="Delete"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
