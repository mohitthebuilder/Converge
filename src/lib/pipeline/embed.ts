import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const BATCH_SIZE = 100
const MAX_CHARS = 30000

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map(t => t.slice(0, MAX_CHARS))

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    })

    const batchEmbeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding)

    allEmbeddings.push(...batchEmbeddings)
  }

  return allEmbeddings
}

export async function embedQuery(query: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })

  return response.data[0].embedding
}
