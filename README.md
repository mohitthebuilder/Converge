# Converge

All your tools. One answer.

Vertical AI-powered knowledge base search for Product Managers. Ask in plain English, get a synthesized answer with cited sources from your PM tools.

## Stack

- **Frontend + Backend:** Next.js (TypeScript, App Router)
- **Database:** Supabase (PostgreSQL + pgvector)
- **LLM:** Claude Sonnet 4.6 (synthesis), OpenAI text-embedding-3-small (embeddings)
- **Auth:** Supabase Auth (Google OAuth only)
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Design reference:** Perplexity (primary), Notion (secondary)

## Development

```bash
export PATH="/usr/local/Cellar/node@20/20.20.2/bin:$PATH"
cd converge
npx next dev
```

Open http://localhost:3000

## Environment

Requires `.env.local` with:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
