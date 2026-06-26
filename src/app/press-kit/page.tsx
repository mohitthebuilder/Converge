import { getSessionUser } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

const ASSETS = [
  { label: 'Horizontal lockup', src: '/brand/lockup-option2-horizontal.svg' },
  { label: 'Stacked lockup', src: '/brand/lockup-option2-stacked.svg' },
  { label: 'Logomark', src: '/brand/logomark-option2.svg' },
  { label: 'Wordmark', src: '/brand/wordmark.svg' },
  { label: 'Favicon', src: '/brand/favicon-option2.svg' },
]

export default async function PressKitPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-indigo-50/30 to-white">
      <header className="flex items-center justify-between border-b border-border/50 px-6 py-2.5">
        <a href="/" className="transition-opacity duration-150 hover:opacity-70">
          <img src="/brand/lockup-option2-horizontal.svg" alt="Converge" className="h-7" />
        </a>
        <a href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Back to search
        </a>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Press kit</h1>
        <p className="mt-1 text-sm text-muted-foreground">Brand assets for Converge.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ASSETS.map((a) => (
            <div key={a.src} className="rounded-xl border border-border/60 bg-background p-5">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">{a.label}</p>
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
