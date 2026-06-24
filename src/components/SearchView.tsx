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
  { key: 'google_drive', name: 'Google Drive', authUrl: '/api/auth/google-drive',
    icon: <svg viewBox="0 0 87.3 78" className="h-4 w-4"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA"/><path d="M43.65 25.15L29.9 1.35c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 00-1.2 4.5h27.5l16.15-28z" fill="#00AC47"/><path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.7c.8-1.4 1.2-2.95 1.2-4.5H59.8L43.65 25.15 27.5 53.2h32.1l13.95 23.6z" fill="#EA4335"/><path d="M43.65 25.15L57.4 1.35C56.05.55 54.5 0 52.85 0H34.44c-1.65 0-3.2.55-4.55 1.35l13.76 23.8z" fill="#00832D"/><path d="M59.8 53.2H27.5l-13.75 23.6c1.35.8 2.9 1.2 4.55 1.2h50.7c1.65 0 3.2-.45 4.55-1.2L59.8 53.2z" fill="#2684FC"/><path d="M73.4 26.5L60.7 4.65c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25.15 59.8 53.2h27.45c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/></svg> },
  { key: 'slack', name: 'Slack', authUrl: null,
    icon: <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/><path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/><path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/><path d="M15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#ECB22E"/></svg> },
  { key: 'notion', name: 'Notion', authUrl: null,
    icon: <svg viewBox="0 0 100 100" className="h-4 w-4" fill="none"><path d="M6.017 4.313l55.333-4.087c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z" fill="#fff" stroke="#000" strokeWidth="4"/><path d="M24.838 34.264V97.85c0 3.483 1.856 4.86 5.75 4.617l62.057-3.63c3.9-.237 4.397-2.38 4.397-5.223V30.173c0-2.843-.868-4.213-3.278-3.987L27.483 30.06c-2.753.237-2.645 1.363-2.645 4.204zm56.332 3.477c.41 1.843 0 3.687-1.843 3.897l-3.073.596v45.077c-2.667 1.437-5.12 2.257-7.163 2.257-3.277 0-4.1-1.027-6.557-4.1l-20.08-31.543v30.53l6.35 1.44s0 3.687-5.12 3.687l-14.13.82c-.41-.82 0-2.873 1.437-3.277l3.687-1.023V42.597l-5.12-.41c-.41-1.843.617-4.51 3.483-4.72l15.157-1.02 20.87 31.95V39.357l-5.327-.616c-.41-2.253 1.233-3.897 3.277-4.103l14.157-.897z" fill="#000"/></svg> },
  { key: 'jira', name: 'Jira', authUrl: null,
    icon: <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 004.34 4.34h1.78v1.72c0 2.4 1.95 4.34 4.35 4.34V7.63a.84.84 0 00-.84-.84H6.77zM2 11.6c0 2.4 1.95 4.34 4.35 4.35h1.78v1.7c.01 2.4 1.95 4.34 4.35 4.35v-9.56a.84.84 0 00-.84-.84H2z" fill="#2684FF"/></svg> },
  { key: 'gmail', name: 'Gmail', authUrl: null,
    icon: <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#4285f4" d="M2 6v12c0 1.1.9 2 2 2h3V9.2L2 5.5V6z"/><path fill="#34a853" d="M17 20h3c1.1 0 2-.9 2-2V6l-5 3.2V20z"/><path fill="#fbbc04" d="M17 4v5.2l5-3.7V4c0-2.3-2.6-3.6-4.4-2.2L17 4z"/><path fill="#ea4335" d="M7 9.2V4l5 3.75L17 4v5.2l-5 3.75L7 9.2z"/><path fill="#c5221f" d="M2 5.5V4c0-2.3 2.6-3.6 4.4-2.2L7 4v5.2L2 5.5z"/></svg> },
  { key: 'figma', name: 'Figma', authUrl: null,
    icon: <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491z" fill="#1ABCFE"/><path d="M6.763 24c2.476 0 4.49-2.014 4.49-4.49v-4.49H6.764c-2.476 0-4.49 2.014-4.49 4.49S4.287 24 6.763 24z" fill="#0ACF83"/><path d="M6.763 15.02h4.49V5.53h-4.49c-2.476 0-4.49 2.014-4.49 4.49s2.014 4.49 4.49 4.49z" fill="#A259FF"/><path d="M6.763 5.021h4.49V-4.47h-4.49C4.287-4.47 2.273-2.456 2.273.02s2.014 5.001 4.49 5.001z" fill="#F24E1E" transform="translate(0 4.49)"/><path d="M15.852 15.02a4.49 4.49 0 100-8.98 4.49 4.49 0 000 8.98z" fill="#FF7262"/></svg> },
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
    return tool?.icon ?? null
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

                {ALL_TOOLS.length > 0 && (
                  <div className="mt-12">
                    <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-muted-foreground/40">
                      Connect more tools
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {ALL_TOOLS.map(tool => (
                        <a
                          key={tool.key}
                          href={tool.authUrl || '#'}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs font-medium text-foreground transition-all duration-150 hover:border-primary/30 hover:shadow-sm"
                        >
                          {tool.icon}
                          {tool.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
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
