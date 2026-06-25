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
            <div className="space-y-0.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`group relative flex items-start rounded-md transition-colors hover:bg-white ${deletingId === item.id ? 'opacity-40' : ''}`}
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
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                    className={`absolute right-2 top-2.5 cursor-pointer rounded p-0.5 text-gray-400 transition-all ${
                      confirmId === item.id
                        ? 'bg-red-50 text-red-500'
                        : 'opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100'
                    }`}
                    title={confirmId === item.id ? 'Click again to confirm' : 'Delete'}
                  >
                    {confirmId === item.id ? (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
