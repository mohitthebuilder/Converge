import { getSessionUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

const ASSETS = [
  { label: 'Horizontal lockup', src: '/brand/lockup-option2-horizontal.svg', filename: 'converge-lockup-horizontal.svg' },
  { label: 'Stacked lockup', src: '/brand/lockup-option2-stacked.svg', filename: 'converge-lockup-stacked.svg' },
  { label: 'Logomark', src: '/brand/logomark-option2.svg', filename: 'converge-logomark.svg' },
  { label: 'Wordmark', src: '/brand/wordmark.svg', filename: 'converge-wordmark.svg' },
  { label: 'Favicon', src: '/brand/favicon-option2.svg', filename: 'converge-favicon.svg' },
]

export default async function PressKitPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 [background-image:radial-gradient(circle,_#4F46E5_0.5px,_transparent_0.5px)] [background-size:24px_24px] opacity-[0.03]" />
      </div>

      <header className="relative z-10 flex items-center justify-between border-b border-border/30 bg-background/80 px-6 py-3 backdrop-blur-md">
        <a href="/" className="transition-opacity duration-150 hover:opacity-70">
          <img src="/brand/lockup-option2-horizontal.svg" alt="Converge" className="h-7" />
        </a>
        <a href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Back to search
        </a>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Press kit</h1>
        <p className="mt-1 text-sm text-muted-foreground">Brand assets for Converge. All files are SVG.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ASSETS.map((a) => (
            <div key={a.src} className="rounded-xl border border-border/60 bg-card p-5 transition-colors duration-150 hover:bg-accent/50">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{a.label}</p>
                <a
                  href={a.src}
                  download={a.filename}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  SVG
                </a>
              </div>
              <div className="flex items-center justify-center rounded-lg bg-muted/30 p-6">
                <img src={a.src} alt={a.label} className="max-h-20" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
