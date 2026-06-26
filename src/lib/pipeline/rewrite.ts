import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface RewriteResult {
  subQueries: string[]
  reasoning: string
}

const REWRITER_PROMPT = `You are a query preprocessor for Converge, a knowledge base search tool for Product Managers. Your job: take the user's raw query and produce 1-3 clear, searchable sub-queries that will maximize retrieval quality from a vector + keyword search index.

<instructions>
<rules>
- ALWAYS output improved queries, even for clear inputs — add relevant context terms that help retrieval (product names, feature names, domain terms).
- If the query is vague ("that pricing thing", "what was decided?"), infer the most likely intent from PM context and expand with specific terms.
- If the query contains temporal references ("last week", "recent", "latest"), resolve to approximate absolute dates. Current date: {today}.
- If the query asks about multiple unrelated things, split into separate sub-queries (max 3). Each sub-query should be independently searchable.
- Fix typos, grammar, and informal language.
- Do NOT add information the user didn't ask about. Only clarify and expand what they meant.
- Do NOT answer the question. Only rewrite it.
</rules>

<acronyms>
Common PM acronyms to expand: CS = Customer Success, DAU = Daily Active Users, MAU = Monthly Active Users, WAU = Weekly Active Users, ARR = Annual Recurring Revenue, MRR = Monthly Recurring Revenue, RBAC = Role-Based Access Control, OKR = Objectives and Key Results, PRD = Product Requirements Document, NPS = Net Promoter Score, CSAT = Customer Satisfaction, P0/P1 = Priority levels, SOC2 = SOC 2 compliance, DPA = Data Processing Agreement, gRPC = gRPC protocol, MoM = Month over Month, QBR = Quarterly Business Review, EBR = Executive Business Review.
</acronyms>
</instructions>

<output_format>
Output valid JSON only, no markdown:
{"subQueries": ["clear query 1", "optional query 2"], "reasoning": "brief explanation of changes"}
</output_format>`

export async function rewriteQuery(rawQuery: string, retryHint?: string): Promise<RewriteResult> {
  const today = new Date().toISOString().split('T')[0]
  let prompt = REWRITER_PROMPT.replace('{today}', today)
  if (retryHint) {
    prompt += `\n\nCRITICAL: ${retryHint}`
  }

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: prompt,
    messages: [{ role: 'user', content: rawQuery }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const parsed = JSON.parse(text)
    return {
      subQueries: parsed.subQueries || [rawQuery],
      reasoning: parsed.reasoning || '',
    }
  } catch {
    return { subQueries: [rawQuery], reasoning: 'Parse failed, using original query' }
  }
}
