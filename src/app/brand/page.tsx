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
    <div className="min-h-full bg-white px-8 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Converge — Brand Kit</h1>
      <p className="mt-1 text-sm text-gray-500">All logo assets. Option 2 is active.</p>
      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((a) => (
          <div key={a.src} className="rounded-xl border border-gray-200 bg-gray-50 p-6">
            <p className="mb-4 text-xs font-medium text-gray-500">{a.label}</p>
            <div className="flex items-center justify-center rounded-lg bg-white p-6">
              <img src={a.src} alt={a.label} className="max-h-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
