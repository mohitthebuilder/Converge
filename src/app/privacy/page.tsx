import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy — Converge',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-full bg-background">
      <header className="border-b border-border/30 bg-background/80 px-6 py-3 backdrop-blur-md">
        <Link href="/">
          <img src="/brand/lockup-option2-horizontal.svg" alt="Converge" className="h-7" />
        </Link>
      </header>

      <main className="mx-auto max-w-[640px] px-6 py-12">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mb-10 text-sm text-muted-foreground">Last updated: June 30, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="mb-2 text-base font-semibold">What Converge does</h2>
            <p>Converge is an AI-powered knowledge search tool for Product Managers. It connects to your existing work tools (Google Drive, Gmail, Slack, Jira), indexes your content, and lets you ask natural-language questions with cited answers.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">Data we collect</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong>Account data:</strong> your name, email address, and profile photo from Google OAuth sign-in.</li>
              <li><strong>Connected tool data:</strong> documents, emails, messages, and issues from tools you explicitly connect. We only access data you authorize via OAuth.</li>
              <li><strong>Usage data:</strong> search queries, answer ratings, and timestamps to improve result quality.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">How we use your data</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>To index and search your connected tool content.</li>
              <li>To generate AI-powered answers to your queries.</li>
              <li>To improve retrieval quality based on your feedback.</li>
            </ul>
            <p className="mt-2">We do not sell your data. We do not use your data to train AI models.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">Third-party services</h2>
            <p>Converge uses the following services to operate:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong>Supabase</strong> — authentication and database storage.</li>
              <li><strong>OpenAI</strong> — text embeddings for semantic search.</li>
              <li><strong>Anthropic</strong> — AI-generated answers (Claude).</li>
              <li><strong>Cohere</strong> — search result reranking.</li>
              <li><strong>Vercel</strong> — application hosting.</li>
            </ul>
            <p className="mt-2">Your content is sent to these services only as needed to provide the search functionality. Each provider has their own privacy policy governing data handling.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">Data retention</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>We sync the last 90 days of data from connected tools.</li>
              <li>When you disconnect a tool, all associated data is deleted.</li>
              <li>You can request full account deletion at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">Data isolation</h2>
            <p>Each user&apos;s data is scoped to their account. No user can access, search, or retrieve another user&apos;s data.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">Your rights</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Disconnect any tool and delete its data at any time.</li>
              <li>Request a copy of your stored data.</li>
              <li>Request full account and data deletion.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">Contact</h2>
            <p>For privacy questions or data requests, contact us at <a href="mailto:mohit.goyal.contact@gmail.com" className="text-primary underline underline-offset-2">mohit.goyal.contact@gmail.com</a>.</p>
          </section>
        </div>

        <div className="mt-12 border-t border-border/30 pt-6 text-xs text-muted-foreground">
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">Terms of Service</Link>
          <span className="mx-2">·</span>
          <Link href="/" className="underline underline-offset-2 hover:text-foreground">Back to Converge</Link>
        </div>
      </main>
    </div>
  )
}
