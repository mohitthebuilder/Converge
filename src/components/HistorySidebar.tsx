'use client'

import { useState, useMemo } from 'react'

interface HistorySidebarProps {
  history: { id: string; original_query: string; created_at: string }[]
  show: boolean
  onClose: () => void
  onSelectQuery: (queryId: string) => void
  onDeleteQuery: (queryId: string) => void
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dateGroup(dateStr: string): string {
  const now = new Date()
  const then = new Date(dateStr)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  if (then >= today) return 'Today'
  if (then >= yesterday) return 'Yesterday'
  if (then >= weekAgo) return 'This week'
  return 'Earlier'
}

export default function HistorySidebar({ history, show, onClose, onSelectQuery, onDeleteQuery }: HistorySidebarProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!filter.trim()) return history
    const q = filter.toLowerCase()
    return history.filter(h => h.original_query.toLowerCase().includes(q))
  }, [history, filter])

  const grouped = useMemo(() => {
    const groups: { label: string; items: typeof history }[] = []
    const seen = new Set<string>()
    for (const item of filtered) {
      const label = dateGroup(item.created_at)
      if (!seen.has(label)) {
        seen.add(label)
        groups.push({ label, items: [] })
      }
      groups.find(g => g.label === label)!.items.push(item)
    }
    return groups
  }, [filtered])

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
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${show ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      <aside className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-border/50 bg-background/90 shadow-xl backdrop-blur-xl transition-transform duration-200 ease-out ${show ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h2 className="text-[13px] font-semibold text-foreground">Search history</h2>
          <button onClick={onClose} className="cursor-pointer rounded-lg p-1.5 text-foreground/70 transition-colors duration-150 hover:bg-muted hover:text-foreground">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter history..."
              className="w-full rounded-lg border border-border/50 bg-muted/30 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <svg className="h-8 w-8 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2 text-xs text-muted-foreground">{filter ? 'No matching queries' : 'No queries yet'}</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="mt-4 first:mt-1">
                <div className="mb-2 flex items-center gap-2 px-2">
                  <p className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-primary/70">{group.label}</p>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={`group relative rounded-lg transition-colors duration-150 hover:bg-muted/50 ${deletingId === item.id ? 'opacity-40' : ''}`}
                    >
                      <div
                        onClick={() => onSelectQuery(item.id)}
                        className="w-full cursor-pointer px-3 py-2 text-left"
                      >
                        <p className="truncate pr-2 text-[13px] font-medium text-foreground">{item.original_query}</p>
                        <div className="mt-0.5 flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">{relativeTime(item.created_at)}</p>
                          {confirmId === item.id ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <span className="mr-0.5 text-[11px] font-medium text-foreground">Delete?</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                                className="cursor-pointer rounded p-0.5 text-emerald-600 transition-colors hover:bg-emerald-50"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmId(null) }}
                                className="cursor-pointer rounded p-0.5 text-red-500 transition-colors hover:bg-red-50"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                              className="cursor-pointer rounded-md p-0.5 text-muted-foreground opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  )
}
