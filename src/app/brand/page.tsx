export default function BrandPage() {
  const assets = [
    { label: 'Option 2 — Logomark', src: '/brand/logomark-option2.svg' },
    { label: 'Option 3 — Logomark', src: '/brand/logomark-option3.svg' },
    { label: 'Wordmark', src: '/brand/wordmark.svg' },
    { label: 'Option 2 — Horizontal Lockup', src: '/brand/lockup-option2-horizontal.svg' },
    { label: 'Option 2 — Stacked Lockup', src: '/brand/lockup-option2-stacked.svg' },
    { label: 'Option 3 — Horizontal Lockup', src: '/brand/lockup-option3-horizontal.svg' },
    { label: 'Option 3 — Stacked Lockup', src: '/brand/lockup-option3-stacked.svg' },
    { label: 'Option 2 — Favicon', src: '/brand/favicon-option2.svg' },
    { label: 'Option 3 — Favicon', src: '/brand/favicon-option3.svg' },
  ]

  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 [background-image:radial-gradient(circle,_#4F46E5_0.5px,_transparent_0.5px)] [background-size:24px_24px] opacity-[0.03]" />
      </div>

      <header className="relative z-10 flex items-center justify-between border-b border-border/30 bg-background/80 px-6 py-3 backdrop-blur-md">
        <a href="/">
          <img src="/brand/lockup-option2-horizontal.svg" alt="Converge" className="h-7" />
        </a>
        <a href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Back to search
        </a>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl px-6 py-12">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Brand kit</h1>
        <p className="mt-1 text-sm text-muted-foreground">All logo assets. Option 2 is active.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <div key={a.src} className="rounded-xl border border-border/60 bg-card p-5 transition-colors duration-150 hover:bg-accent/50">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{a.label}</p>
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
