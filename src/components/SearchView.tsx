'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import HistorySidebar from './HistorySidebar'
import AnswerView from './AnswerView'
import Rating from './Rating'

interface Source {
  index: number
  title: string
  tool: string
  url: string
  similarity: number
}

interface Connection {
  id: string
  source_type: string
  status: string
  last_synced_at: string | null
}

interface SearchViewProps {
  user: { id: string; email: string; name: string; avatar_url?: string }
  connections: Connection[]
  history: { id: string; original_query: string; created_at: string }[]
  autoSync?: string | null
}

const ALL_TOOLS = [
  { key: 'google_drive', name: 'Google Drive', desc: 'Docs, slides, and sheets', authUrl: '/api/auth/google-drive', icon: '/icons/googledrive.svg', comingSoon: false },
  { key: 'gmail', name: 'Gmail', desc: 'Emails and threads', authUrl: '/api/auth/gmail', icon: '/icons/gmail.svg', comingSoon: false },
  { key: 'slack', name: 'Slack', desc: 'Messages and channels', authUrl: null, icon: '/icons/slack.svg', comingSoon: false },
  { key: 'jira', name: 'Jira', desc: 'Issues and projects', authUrl: null, icon: '/icons/jira.svg', comingSoon: false },
  { key: 'notion', name: 'Notion', desc: 'Pages and databases', authUrl: null, icon: '/icons/notion.svg', comingSoon: true },
  { key: 'figma', name: 'Figma', desc: 'Designs and prototypes', authUrl: null, icon: '/icons/figma.svg', comingSoon: true },
]

const PLACEHOLDERS = [
  'Why did we decide to go with usage-based pricing?',
  'What are the open blockers for the Q3 launch?',
  'Who owns the billing integration?',
  'What did the team decide about the API redesign?',
]

const SYNC_ENDPOINTS: Record<string, string> = {
  gmail: '/api/connectors/gmail/sync',
  google_drive: '/api/connectors/google-drive/sync',
}

const TOOL_LABELS: Record<string, string> = {
  gmail: 'Gmail',
  google_drive: 'Google Drive',
}

export default function SearchView({ user, connections: initialConnections, history: initialHistory, autoSync }: SearchViewProps) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  const [answerId, setAnswerId] = useState<string | null>(null)
  const [confidence, setConfidence] = useState<{ level: string; message: string } | null>(null)
  const [typedPlaceholder, setTypedPlaceholder] = useState('')
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [typePhase, setTypePhase] = useState<'typing' | 'pausing' | 'deleting'>('typing')
  const [syncStatuses, setSyncStatuses] = useState<Record<string, string>>({})
  const [localConnections, setLocalConnections] = useState<Connection[]>(initialConnections)
  const [localHistory, setLocalHistory] = useState(initialHistory)
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null)
  const [noResults, setNoResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchStartRef = useRef<number>(0)

  useEffect(() => {
    if (query) return
    const phrase = PLACEHOLDERS[phraseIdx % PLACEHOLDERS.length]
    if (typePhase === 'typing') {
      if (typedPlaceholder.length < phrase.length) {
        const t = setTimeout(() => setTypedPlaceholder(phrase.slice(0, typedPlaceholder.length + 1)), 30)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setTypePhase('deleting'), 2000)
      return () => clearTimeout(t)
    }
    if (typePhase === 'deleting') {
      if (typedPlaceholder.length > 0) {
        const t = setTimeout(() => setTypedPlaceholder(typedPlaceholder.slice(0, -1)), 15)
        return () => clearTimeout(t)
      }
      setPhraseIdx(prev => prev + 1)
      setTypePhase('typing')
    }
  }, [typedPlaceholder, typePhase, phraseIdx, query])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!autoSync) return
    const syncEndpoint = SYNC_ENDPOINTS[autoSync]
    if (!syncEndpoint) return

    const conn = localConnections.find(c => c.source_type === autoSync)
    if (!conn) return

    runToolSync(autoSync, conn.id, syncEndpoint)
    window.history.replaceState({}, '', '/')
  }, [autoSync])

  async function runToolSync(toolKey: string, connectionId: string, syncEndpoint: string) {
    const toolLabel = TOOL_LABELS[toolKey] || toolKey
    try {
      setSyncStatuses(prev => ({ ...prev, [toolKey]: `Syncing ${toolLabel}...` }))
      const syncRes = await fetch(syncEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      if (!syncRes.ok) {
        setSyncStatuses(prev => ({ ...prev, [toolKey]: `${toolLabel} sync failed` }))
        return
      }

      setSyncStatuses(prev => ({ ...prev, [toolKey]: `Processing ${toolLabel}...` }))
      await fetch('/api/pipeline/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })

      setSyncStatuses(prev => ({ ...prev, [toolKey]: `Indexing ${toolLabel}...` }))
      let hasMore = true
      while (hasMore) {
        const embedRes = await fetch('/api/pipeline/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId }),
        })
        const embedResult = await embedRes.json()
        hasMore = embedResult.remaining && embedResult.remaining !== 0
      }

      setSyncStatuses(prev => ({ ...prev, [toolKey]: 'ready' }))
      setTimeout(() => setSyncStatuses(prev => {
        const next = { ...prev }
        delete next[toolKey]
        return next
      }), 5000)
    } catch {
      setSyncStatuses(prev => ({ ...prev, [toolKey]: `${TOOL_LABELS[toolKey] || toolKey} sync failed` }))
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || isSearching) return

    searchStartRef.current = Date.now()
    setIsSearching(true)
    setAnswer('')
    setSources([])
    setLatencyMs(null)
    setCurrentQuery(query.trim())
    setAnswerId(null)
    setConfidence(null)
    setNoResults(false)
    setTimeout(() => inputRef.current?.blur(), 0)

    try {
      const response = await fetch('/api/query/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })

      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''
      let fullAnswer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))

          if (data.type === 'sources') {
            setSources(data.sources || [])
          } else if (data.type === 'confidence') {
            if (data.level === 'none') {
              setSources([])
              setConfidence(null)
              setNoResults(true)
            } else {
              setConfidence({ level: data.level, message: data.message })
            }
          } else if (data.type === 'answer_replace') {
            setAnswer(data.content)
          } else if (data.type === 'text') {
            fullAnswer += data.content
            setAnswer((prev) => prev + data.content)
          } else if (data.type === 'done') {
            setLatencyMs(Date.now() - searchStartRef.current)
            if (data.answerId) setAnswerId(data.answerId)
          }
        }
      }
    } catch {
      setAnswer('Something went wrong. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  function handleNewQuery() {
    setQuery('')
    setAnswer('')
    setSources([])
    setLatencyMs(null)
    setCurrentQuery('')
    setAnswerId(null)
    setConfidence(null)
    setNoResults(false)
    inputRef.current?.focus()
  }

  async function handleSelectQuery(queryId: string) {
    try {
      const res = await fetch(`/api/query/history?id=${queryId}`)
      if (!res.ok) return
      const data = await res.json()
      setCurrentQuery(data.query)
      setAnswer(data.answer)
      setSources(data.sources || [])
      setLatencyMs(data.latencyMs)
      setAnswerId(data.answerId)
      setConfidence(null)
      setNoResults(false)
      setQuery('')
      setShowSidebar(false)
    } catch {
      // ignore
    }
  }

  async function handleDeleteQuery(queryId: string) {
    try {
      await fetch(`/api/query/history?id=${queryId}`, { method: 'DELETE' })
      setLocalHistory(prev => prev.filter(h => h.id !== queryId))
    } catch {
      // ignore
    }
  }

  async function handleDisconnect(sourceType: string) {
    if (disconnectConfirm !== sourceType) {
      setDisconnectConfirm(sourceType)
      setTimeout(() => setDisconnectConfirm(prev => prev === sourceType ? null : prev), 4000)
      return
    }
    setDisconnectConfirm(null)
    await fetch('/api/connectors/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceType }),
    })
    setLocalConnections(prev => prev.filter(c => c.source_type !== sourceType))
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.reload()
  }

  const hasAnswer = answer.length > 0 || isSearching
  const connectedKeys = new Set(localConnections.filter(c => c.status === 'active').map(c => c.source_type))

  function getToolIcon(toolName: string) {
    const tool = ALL_TOOLS.find(t => t.name === toolName)
    return tool ? <img src={tool.icon} alt={tool.name} className="h-4 w-4" /> : null
  }

  function getToolStatus(toolKey: string): 'live' | 'syncing' | 'disconnected' | 'unavailable' {
    if (syncStatuses[toolKey]) {
      if (syncStatuses[toolKey] === 'ready') return 'live'
      if (syncStatuses[toolKey].includes('failed')) return 'disconnected'
      return 'syncing'
    }
    if (connectedKeys.has(toolKey)) return 'live'
    const tool = ALL_TOOLS.find(t => t.key === toolKey)
    if (!tool?.authUrl) return 'unavailable'
    return 'disconnected'
  }

  const activeSyncs = Object.entries(syncStatuses).filter(([, v]) => v !== 'ready' && !v.includes('failed'))

  return (
    <div className="flex h-full bg-gradient-to-b from-indigo-50/30 to-white">
      <HistorySidebar
        history={localHistory}
        show={showSidebar}
        onClose={() => setShowSidebar(false)}
        onSelectQuery={handleSelectQuery}
        onDeleteQuery={handleDeleteQuery}
      />

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/50 bg-background/80 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="cursor-pointer text-foreground/70 transition-colors duration-150 hover:text-foreground"
            >
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
            <button onClick={handleNewQuery} className="cursor-pointer transition-opacity duration-150 hover:opacity-70">
              <img src="/brand/lockup-option2-horizontal.svg" alt="Converge" className="h-7" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full outline-none ring-2 ring-border/30 transition-all duration-150 hover:ring-primary/40">
                <img
                  src={`https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(user.email)}&backgroundColor=eef2ff`}
                  alt={user.name || user.email}
                  className="h-full w-full object-cover"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-64">
                <div className="flex items-center gap-3 px-2 py-2">
                  <img
                    src={`https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${encodeURIComponent(user.email)}&backgroundColor=eef2ff`}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Connected tools</p>
                  {localConnections.length === 0 && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">No tools connected</p>
                  )}
                  {localConnections.map((c) => {
                    const tool = ALL_TOOLS.find(t => t.key === c.source_type)
                    const status = getToolStatus(c.source_type)
                    return (
                      <div key={c.source_type} className="flex items-center justify-between px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          {tool && <img src={tool.icon} alt={tool.name} className="h-3.5 w-3.5" />}
                          <span className="text-sm">{tool?.name || c.source_type}</span>
                          {status === 'live' && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-600">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              </span>
                              Live
                            </span>
                          )}
                          {status === 'syncing' && (
                            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-600">
                              <svg className="h-2.5 w-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Syncing
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDisconnect(c.source_type)}
                          className={`cursor-pointer rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                            disconnectConfirm === c.source_type
                              ? 'bg-red-100 font-medium text-red-600'
                              : 'text-muted-foreground hover:bg-red-50 hover:text-red-500'
                          }`}
                        >
                          {disconnectConfirm === c.source_type ? 'Confirm?' : 'Disconnect'}
                        </button>
                      </div>
                    )
                  })}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <a href="/press-kit">Press kit</a>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" variant="destructive" onSelect={handleLogout}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Per-tool sync banners */}
        {activeSyncs.map(([toolKey, phase]) => (
          <div key={toolKey} className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs ${
            phase.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-primary/5 text-primary'
          }`}>
            {!phase.includes('failed') && (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {phase}
          </div>
        ))}
        {Object.entries(syncStatuses).filter(([, v]) => v === 'ready').map(([toolKey]) => (
          <div key={toolKey} className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs bg-emerald-50 text-emerald-700">
            {TOOL_LABELS[toolKey] || toolKey} synced — ready to search!
          </div>
        ))}

        {/* Main content */}
        <main className={`relative flex flex-1 flex-col items-center ${hasAnswer ? 'pt-0' : 'justify-center'} overflow-y-auto`}>

          {/* Background depth layers */}
          {!hasAnswer && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 [background-image:radial-gradient(circle,_#4F46E5_0.5px,_transparent_0.5px)] [background-size:24px_24px] opacity-[0.03]" />
              <div className="absolute -top-[120px] left-1/2 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-100/60 blur-[100px]" />
              <div className="absolute -bottom-[80px] -left-[150px] h-[350px] w-[350px] rounded-full bg-primary/[0.04] blur-[80px]" />
              <div className="absolute -bottom-[60px] -right-[150px] h-[300px] w-[300px] rounded-full bg-indigo-200/30 blur-[80px]" />
            </div>
          )}

          <div className={`relative w-full ${hasAnswer ? 'max-w-[720px] px-8' : 'max-w-[580px] px-6'}`}>

            {/* Empty state */}
            {!hasAnswer && (
              <div className="mb-8">
                <div className="mb-3 flex justify-center">
                  <img src="/brand/lockup-option2-horizontal.svg" alt="Converge" className="h-16" />
                </div>
                <p className="mb-10 text-center text-[15px] text-muted-foreground">
                  All your tools. One answer.
                </p>

                <form onSubmit={handleSearch} className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={typedPlaceholder}
                    className="w-full rounded-2xl border border-border/80 bg-background px-6 py-4 pr-14 text-[15px] text-foreground shadow-md transition-all duration-300 placeholder:text-muted-foreground/40 focus:border-primary/40 focus:shadow-lg focus:shadow-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !query.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-xl bg-primary p-2.5 text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-[0.95] disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </form>

                <div className="mt-5 flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
                      <svg className="h-3 w-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" /></svg>
                      Multi-source
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
                      <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                      Cited answers
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
                      <svg className="h-3 w-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      AI-powered
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/70">/</kbd> to search
                  </span>
                </div>

                <div className="mt-12">
                  <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                    Your tools
                  </p>
                  <div className="mx-auto grid w-full max-w-[520px] grid-cols-1 gap-2 sm:grid-cols-2">
                    {ALL_TOOLS.map(tool => {
                      const status = getToolStatus(tool.key)
                      const isSyncing = status === 'syncing'

                      function handleToolClick(e: React.MouseEvent) {
                        if (status === 'live') {
                          e.preventDefault()
                          handleDisconnect(tool.key)
                        } else if (status === 'unavailable') {
                          e.preventDefault()
                        }
                      }

                      return (
                        <a
                          key={tool.key}
                          href={status === 'disconnected' && tool.authUrl ? tool.authUrl : '#'}
                          onClick={handleToolClick}
                          className={`flex items-center gap-3 rounded-xl border p-3 transition-colors duration-150 ${
                            status === 'live'
                              ? 'cursor-pointer border-border/50 bg-card hover:bg-accent/50 active:scale-[0.98]'
                              : status === 'syncing'
                              ? 'border-blue-200 bg-blue-50/30'
                              : status === 'unavailable'
                              ? 'cursor-default border-border/40 bg-card'
                              : 'cursor-pointer border-border/50 bg-card hover:bg-accent/50 active:scale-[0.98]'
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                            <img src={tool.icon} alt={tool.name} className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{tool.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{tool.desc}</p>
                          </div>
                          <div className="shrink-0">
                            {status === 'live' && !disconnectConfirm && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                </span>
                                Live
                              </span>
                            )}
                            {status === 'live' && disconnectConfirm === tool.key && (
                              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                                Disconnect?
                              </span>
                            )}
                            {isSyncing && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                <svg className="h-2.5 w-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Syncing
                              </span>
                            )}
                            {status === 'disconnected' && (
                              <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Connect
                              </span>
                            )}
                            {status === 'unavailable' && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Soon
                              </span>
                            )}
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Answer state */}
            {hasAnswer && (
              <>
                {/* Compact search bar */}
                <form onSubmit={handleSearch} className="sticky top-0 z-10 pb-3 pt-4 backdrop-blur-sm">
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ask a follow-up..."
                      className="w-full rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 pr-10 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/40 focus:border-primary/30 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/10"
                    />
                    <button
                      type="submit"
                      disabled={isSearching || !query.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-all duration-150 hover:text-primary disabled:cursor-default disabled:opacity-30"
                    >
                      {isSearching ? (
                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </form>

                {/* Query echo */}
                {currentQuery && !isSearching && (
                  <div className="mt-1 flex items-start gap-2">
                    <h2 className="flex-1 text-xl font-medium tracking-tight text-foreground">{currentQuery}</h2>
                    <button
                      onClick={() => { setQuery(currentQuery); setTimeout(() => { const form = document.querySelector('form'); form?.requestSubmit() }, 50) }}
                      className="mt-1 shrink-0 cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-[0.95]"
                      title="Re-run this query"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Confidence tag */}
                {confidence && !isSearching && (
                  <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    confidence.level === 'high'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : confidence.level === 'medium'
                      ? 'border border-green-200 bg-green-50 text-green-700'
                      : 'border border-amber-200 bg-amber-50 text-amber-700'
                  }`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                      confidence.level === 'high' ? 'bg-emerald-500' : confidence.level === 'medium' ? 'bg-green-500' : 'bg-amber-500'
                    }`} />
                    Confidence: {confidence.level === 'high' ? 'High' : confidence.level === 'medium' ? 'Good' : 'Average'}
                  </div>
                )}

                {/* Answer */}
                <AnswerView answer={answer} isStreaming={isSearching} query={currentQuery} />

                {/* No relevant info state */}
                {!isSearching && noResults && (
                  <div className="mt-6 flex flex-col items-center rounded-xl border border-primary/10 bg-primary/[0.03] py-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <img src="/brand/logomark-option2.svg" alt="" className="h-7 w-7" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-foreground">No relevant information found</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try rephrasing your question or connecting more tools.</p>
                  </div>
                )}

                {/* Sources */}
                {!isSearching && sources.length > 0 && (() => {
                  const ranked = sources
                    .filter(s => s.similarity >= 0.3)
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 6)
                  if (ranked.length === 0) return null
                  return (
                    <div className="mt-3 border-t border-border/30 pt-5">
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {ranked.length} {ranked.length === 1 ? 'source' : 'sources'}
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {ranked.map((s, i) => {
                          const icon = getToolIcon(s.tool)
                          return (
                            <a
                              key={i}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-start gap-3 rounded-xl border border-border/40 bg-muted/20 p-3 transition-all duration-150 hover:border-border/80 hover:bg-muted/40 hover:shadow-sm"
                            >
                              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                {icon || <span className="text-[11px] font-semibold text-primary">?</span>}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-foreground/90 transition-colors duration-150 group-hover:text-primary">{s.title}</p>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                  <p className="text-[11px] text-muted-foreground">{s.tool}</p>
                                </div>
                              </div>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Footer */}
                {!isSearching && answer && (
                  <div className="mt-5 flex items-center justify-between border-t border-border/40 pb-10 pt-4">
                    <span className="text-[11px] text-muted-foreground">
                      {latencyMs && `${(latencyMs / 1000).toFixed(1)}s`}
                    </span>
                    <Rating answerId={answerId} />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
