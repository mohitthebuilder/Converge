'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

const PLACEHOLDERS = [
  'Why did we decide to go with usage-based pricing?',
  'What are the open blockers for the Q3 launch?',
  'Who owns the billing integration?',
  'What did the team decide about the API redesign?',
]

const TOOLS = [
  { name: 'Google Drive', icon: '/icons/googledrive.svg' },
  { name: 'Gmail', icon: '/icons/gmail.svg' },
  { name: 'Slack', icon: '/icons/slack.svg' },
  { name: 'Jira', icon: '/icons/jira.svg' },
]

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [typedPlaceholder, setTypedPlaceholder] = useState('')
  const [phraseIdx, setPhraseIdx] = useState(0)
  const [typePhase, setTypePhase] = useState<'typing' | 'pausing' | 'deleting'>('typing')

  useEffect(() => {
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
  }, [typedPlaceholder, typePhase, phraseIdx])

  async function handleGoogleLogin() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="mt-4 text-sm text-muted-foreground">Redirecting to Google...</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-full overflow-y-auto">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 [background-image:radial-gradient(circle,_#4F46E5_0.5px,_transparent_0.5px)] [background-size:24px_24px] opacity-[0.03]" />
        <div className="absolute -top-[250px] left-1/2 h-[800px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-100/50 blur-[150px]" />
        <div className="absolute -bottom-[150px] -left-[100px] h-[600px] w-[600px] rounded-full bg-indigo-50/40 blur-[120px]" />
        <div className="absolute -bottom-[120px] -right-[100px] h-[550px] w-[550px] rounded-full bg-indigo-200/25 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.02] blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-border/30 bg-background/80 px-6 py-3 backdrop-blur-md">
        <img src="/brand/lockup-option2-horizontal.svg" alt="Converge" className="h-7" />
        <Button
          variant="default"
          size="sm"
          className="gap-2 text-xs active:scale-[0.98]"
          onClick={handleGoogleLogin}
        >
          Sign in
        </Button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-[600px] px-6 pb-10 pt-20 text-center">
        <div className="mb-4 flex justify-center">
          <img src="/brand/lockup-option2-horizontal.svg" alt="Converge" className="h-16" />
        </div>
        <p className="mb-6 text-lg text-muted-foreground">All your PM tools. One AI-powered answer.</p>

        {/* Feature pills */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
            <svg className="h-3 w-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" /></svg>
            Multi-source
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
            <svg className="h-3 w-3 text-emerald-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
            Cited answers
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
            <svg className="h-3 w-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            AI-powered
          </span>
        </div>

        {/* Primary CTA */}
        <Button
          variant="outline"
          className="mx-auto gap-2 px-8 py-5 text-sm font-medium shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]"
          onClick={handleGoogleLogin}
        >
          <GoogleIcon />
          Continue with Google
        </Button>
        <p className="mt-3 text-[11px] text-muted-foreground">
          By continuing, you agree to Converge&apos;s{' '}
          <a href="#" className="underline underline-offset-2 hover:text-foreground">Terms of Service</a> and{' '}
          <a href="#" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</a>.
        </p>
      </section>

      {/* Product preview */}
      <section className="relative z-10 mx-auto max-w-[520px] px-6 pb-16">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-border/40 bg-muted/30 px-3 py-2">
            <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#27C93F]" />
          </div>
          <div className="px-5 py-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-left">
              <span className="text-[14px] text-muted-foreground">{typedPlaceholder}<span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary/40 align-text-bottom" /></span>
            </div>
          </div>
        </div>
      </section>

      {/* Works with */}
      <section className="relative z-10 border-t border-border/30 bg-muted/20 py-10">
        <div className="mx-auto max-w-[600px] px-6 text-center">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Works with</p>
          <div className="flex items-start justify-center gap-6">
            {TOOLS.map(tool => (
              <div key={tool.name} className="flex w-16 flex-col items-center">
                <img src={tool.icon} alt={tool.name} className="h-6 w-6" />
                <span className="mt-1.5 text-[11px] text-muted-foreground">{tool.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto max-w-[600px] px-6 py-16">
        <p className="mb-8 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">How it works</p>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">1</div>
            <p className="text-sm font-medium text-foreground">Connect your tools</p>
            <p className="mt-1 text-xs text-muted-foreground">One-click OAuth for each tool. No API keys.</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">2</div>
            <p className="text-sm font-medium text-foreground">Ask a question</p>
            <p className="mt-1 text-xs text-muted-foreground">Natural language. Like asking a teammate who reads everything.</p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">3</div>
            <p className="text-sm font-medium text-foreground">Get cited answers</p>
            <p className="mt-1 text-xs text-muted-foreground">AI synthesizes across sources. Every claim links to the original.</p>
          </div>
        </div>
      </section>

      {/* Trust + bottom CTA */}
      <section className="relative z-10 border-t border-border/30 bg-muted/20 py-12">
        <div className="mx-auto max-w-[400px] px-6 text-center">
          <div className="mb-8 flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <span className="text-xs text-muted-foreground">Your data stays yours</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="text-xs text-muted-foreground">End-to-end encrypted</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full gap-2 py-5 text-sm font-medium shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            onClick={handleGoogleLogin}
          >
            <GoogleIcon />
            Continue with Google
          </Button>
        </div>
      </section>
    </div>
  )
}
