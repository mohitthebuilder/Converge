'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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

interface SearchViewProps {
  user: { id: string; email: string; name: string; avatar_url?: string }
  connections: { source_type: string; status: string; last_synced_at: string | null }[]
  history: { id: string; original_query: string; created_at: string }[]
}

const ALL_TOOLS = [
  { key: 'google_drive', name: 'Google Drive', authUrl: '/api/auth/google-drive', icon: '/icons/googledrive.svg' },
  { key: 'slack', name: 'Slack', authUrl: null, icon: '/icons/slack.svg' },
  { key: 'notion', name: 'Notion', authUrl: null, icon: '/icons/notion.svg' },
  { key: 'jira', name: 'Jira', authUrl: null, icon: '/icons/jira.svg' },
  { key: 'gmail', name: 'Gmail', authUrl: null, icon: '/icons/gmail.svg' },
  { key: 'figma', name: 'Figma', authUrl: null, icon: '/icons/figma.svg' },
]

const PLACEHOLDERS = [
  'Why did we decide to go with usage-based pricing?',
  'What are the open blockers for the Q3 launch?',
  'Who owns the billing integration?',
  'What did the team decide about the API redesign?',
]

export default function SearchView({ user, connections, history }: SearchViewProps) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  const [answerId, setAnswerId] = useState<string | null>(null)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPlaceholderIndex(Math.floor(Math.random() * PLACEHOLDERS.length))
  }, [])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || isSearching) return

    setIsSearching(true)
    setAnswer('')
    setSources([])
    setLatencyMs(null)
    setCurrentQuery(query.trim())
    setAnswerId(null)
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
          } else if (data.type === 'text') {
            setAnswer((prev) => prev + data.content)
          } else if (data.type === 'done') {
            setLatencyMs(data.latencyMs)
          }
        }
      }
    } catch (err) {
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
    inputRef.current?.focus()
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.reload()
  }

  const hasAnswer = answer.length > 0 || isSearching
  const connectedKeys = new Set(connections.filter(c => c.status === 'active').map(c => c.source_type))

  function getToolIcon(toolName: string) {
    const tool = ALL_TOOLS.find(t => t.name === toolName)
    return tool ? <img src={tool.icon} alt={tool.name} className="h-4 w-4" /> : null
  }

  return (
    <div className="flex h-full bg-background">
      <HistorySidebar
        history={history}
        show={showSidebar}
        onClose={() => setShowSidebar(false)}
      />

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/50 px-6 py-2.5">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
            <button onClick={handleNewQuery} className="text-[15px] font-semibold tracking-tight text-foreground transition-opacity duration-150 hover:opacity-70">
              Converge
            </button>
          </div>

          <div className="flex items-center gap-2">
            {hasAnswer && (
              <Button variant="ghost" size="sm" onClick={handleNewQuery} className="text-xs text-muted-foreground transition-colors duration-150">
                New search
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground outline-none transition-all duration-150 hover:opacity-90">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Connected tools</DropdownMenuLabel>
                {connections.map((c) => (
                  <div key={c.source_type} className="flex items-center gap-2 px-2 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-sm">{c.source_type.replace('_', ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}</span>
                  </div>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => { window.location.href = '/settings' }}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main content */}
        <main className={`flex flex-1 flex-col items-center ${hasAnswer ? 'pt-0' : 'justify-center'} overflow-y-auto`}>
          <div className={`w-full ${hasAnswer ? 'max-w-[720px] px-8' : 'max-w-[580px] px-6'}`}>

            {/* Empty state */}
            {!hasAnswer && (
              <div className="mb-8">
                <h1 className="mb-10 text-center text-[28px] font-medium tracking-tight text-foreground/90">
                  What do you want to know?
                </h1>

                <form onSubmit={handleSearch} className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={PLACEHOLDERS[placeholderIndex]}
                    className="w-full rounded-2xl border border-border bg-muted/40 px-6 py-4 pr-14 text-[15px] text-foreground shadow-sm transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary/30 focus:bg-background focus:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                  <button
                    type="submit"
                    disabled={isSearching || !query.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-primary p-2.5 text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </form>

                <p className="mt-5 text-center text-[13px] text-muted-foreground/50">
                  Search across your connected tools. Get answers with cited sources.
                </p>

                <div className="mt-12">
                  <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-muted-foreground/40">
                    Your tools
                  </p>
                  <div className="grid grid-cols-3 gap-2 mx-auto max-w-[360px]">
                    {ALL_TOOLS.map(tool => {
                      const isConnected = connectedKeys.has(tool.key)
                      return (
                        <a
                          key={tool.key}
                          href={tool.authUrl || '#'}
                          className={`relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-150 hover:shadow-sm ${
                            isConnected
                              ? 'border-emerald-200 bg-emerald-50/50 text-foreground hover:border-emerald-300'
                              : 'border-border/60 bg-background text-foreground hover:border-primary/30'
                          }`}
                        >
                          <img src={tool.icon} alt={tool.name} className="h-4 w-4" />
                          {tool.name}
                          {isConnected && (
                            <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
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
                <form onSubmit={handleSearch} className="sticky top-0 z-10 bg-background/95 pb-3 pt-4 backdrop-blur-sm">
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-all duration-150 hover:text-primary disabled:opacity-30"
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
                  <h2 className="mt-1 text-xl font-medium tracking-tight text-foreground">{currentQuery}</h2>
                )}

                {/* Answer */}
                <AnswerView answer={answer} isStreaming={isSearching} query={currentQuery} />

                {/* Sources */}
                {!isSearching && sources.length > 0 && (
                  <div className="mt-3 border-t border-border/30 pt-5">
                    <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
                      {sources.length} {sources.length === 1 ? 'source' : 'sources'}
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {sources.map((s) => {
                        const icon = getToolIcon(s.tool)
                        return (
                          <a
                            key={s.index}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-3 rounded-xl border border-border/40 bg-muted/20 p-3 transition-all duration-150 hover:border-border/80 hover:bg-muted/40 hover:shadow-sm"
                          >
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-semibold text-primary">
                              {s.index}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-foreground/90 transition-colors duration-150 group-hover:text-primary">{s.title}</p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                {icon && <span className="shrink-0 opacity-60">{icon}</span>}
                                <p className="text-[11px] text-muted-foreground/60">{s.tool}</p>
                              </div>
                            </div>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Footer */}
                {!isSearching && answer && (
                  <div className="mt-5 flex items-center justify-between border-t border-border/20 pb-10 pt-4">
                    <span className="text-[11px] text-muted-foreground/40">
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
