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
    icon: <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.29 2.09c-.42-.326-.98-.7-2.055-.607L3.01 2.648c-.466.046-.56.28-.373.466l1.822 1.094zm.793 3.358v13.91c0 .746.373 1.026 1.213.98l14.523-.84c.84-.046.933-.56.933-1.166V6.63c0-.606-.233-.933-.746-.886l-15.177.886c-.56.047-.746.327-.746.933zm14.337.7c.093.42 0 .84-.42.886l-.7.14v10.264c-.607.327-1.166.513-1.633.513-.746 0-.933-.233-1.493-.933l-4.573-7.178v6.952l1.446.327s0 .84-1.166.84l-3.218.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.093-.42.14-1.026.793-1.073l3.452-.233 4.759 7.272V9.527l-1.213-.14c-.093-.513.28-.886.746-.933l3.218-.186z" fill="currentColor"/></svg> },
  { key: 'jira', name: 'Jira', authUrl: null,
    icon: <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 00-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 004.34 4.34h1.78v1.72c0 2.4 1.95 4.34 4.35 4.34V7.63a.84.84 0 00-.84-.84H6.77zM2 11.6c0 2.4 1.95 4.34 4.35 4.35h1.78v1.7c.01 2.4 1.95 4.34 4.35 4.35v-9.56a.84.84 0 00-.84-.84H2z" fill="#2684FF"/></svg> },
  { key: 'gmail', name: 'Gmail', authUrl: null,
    icon: <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/></svg> },
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
  const unconnected = ALL_TOOLS.filter(t => !connectedKeys.has(t.key))

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

                {unconnected.length > 0 && (
                  <div className="mt-12">
                    <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-widest text-muted-foreground/40">
                      Connect more tools
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {unconnected.map(tool => (
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
