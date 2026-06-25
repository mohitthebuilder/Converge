export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ValidationResult {
  confidence: ConfidenceLevel
  needsRetry: boolean
  message: string
}

const MAX_RETRIES = 2

export function validateRetrieval(
  chunks: Array<{ similarity: number }>,
  retryCount: number
): ValidationResult {
  if (chunks.length === 0) {
    if (retryCount < MAX_RETRIES) {
      return { confidence: 'low', needsRetry: true, message: 'No sources found' }
    }
    return { confidence: 'low', needsRetry: false, message: 'No relevant sources found' }
  }

  const bestScore = Math.max(...chunks.map(c => c.similarity))

  if (bestScore > 0.5) {
    return { confidence: 'high', needsRetry: false, message: '' }
  }

  if (bestScore > 0.4) {
    return { confidence: 'medium', needsRetry: false, message: 'Moderate relevance sources' }
  }

  if (retryCount < MAX_RETRIES) {
    return { confidence: 'low', needsRetry: true, message: 'Low relevance sources' }
  }
  return { confidence: 'low', needsRetry: false, message: 'Limited sources found' }
}
