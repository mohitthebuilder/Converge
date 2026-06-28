'use client'

const SAMPLE_ANSWERS = [
  {
    query: 'Why did we deprioritize the checkout redesign?',
    answer:
      'The team decided to deprioritize checkout redesign in the Q2 planning review due to resource constraints on the payments team [1] and unresolved UX research findings [2].',
    sources: ['Q2 Planning Doc — Google Drive', '#product-decisions — Slack'],
  },
  {
    query: 'What\'s the latest spec for user onboarding?',
    answer:
      'The onboarding spec was updated on June 12 to include a 3-step progressive flow [1]. The mobile variant is still in draft and pending design review [2].',
    sources: ['Onboarding Spec v3 — Notion', 'Design Review Notes — Google Drive'],
  },
]

const PLACEHOLDER_QUERIES = [
  'Why did we decide to go with usage-based pricing?',
  'What are the open blockers for the Q3 launch?',
  'What did the team decide about the API redesign?',
  'Who owns the billing integration?',
]

export default function OnboardingScreen() {
  return (
    <div className="relative flex h-full flex-col items-center overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 [background-image:radial-gradient(circle,_#4F46E5_0.5px,_transparent_0.5px)] [background-size:24px_24px] opacity-[0.03]" />
        <div className="absolute -top-[250px] left-1/2 h-[800px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-100/50 blur-[150px]" />
        <div className="absolute -bottom-[150px] -left-[100px] h-[600px] w-[600px] rounded-full bg-indigo-50/40 blur-[120px]" />
        <div className="absolute -bottom-[120px] -right-[100px] h-[550px] w-[550px] rounded-full bg-indigo-200/25 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.02] blur-[100px]" />
      </div>
      <div className="relative w-full max-w-3xl px-8 pt-16 pb-8">
        <div className="mb-12 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Converge</h1>
          <p className="mt-1 text-sm text-gray-500">All your PM tools. One AI-powered answer.</p>
        </div>

        {/* Visual search bar (disabled) */}
        <div className="relative mb-10">
          <input
            type="text"
            disabled
            placeholder={PLACEHOLDER_QUERIES[0]}
            className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-lg text-gray-500 placeholder:text-gray-400 focus:outline-none"
          />
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
            <svg className="h-5 w-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Sample answer cards */}
        <div className="mb-12 space-y-4">
          {SAMPLE_ANSWERS.map((sample, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-sm font-medium text-indigo-600">{sample.query}</p>
              <p className="text-sm text-gray-900 leading-relaxed">{sample.answer}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sample.sources.map((source, j) => (
                  <span
                    key={j}
                    className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600"
                  >
                    [{j + 1}] {source}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Connect tools */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
          <h2 className="mb-1 text-base font-semibold text-gray-900">
            Connect your tools to get started
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            Converge searches across your PM tools and gives you answers with cited sources.
          </p>

          <a
            href="/api/auth/google-drive"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Connect Google Drive
          </a>

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {['Gmail', 'Slack', 'Jira'].map((tool) => (
              <button
                key={tool}
                disabled
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-400 opacity-50"
              >
                {tool}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
