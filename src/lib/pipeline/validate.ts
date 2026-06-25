export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'very_low'

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
      return { confidence: 'very_low', needsRetry: true, message: '' }
    }
    return { confidence: 'very_low', needsRetry: false, message: '' }
  }

  const bestScore = Math.max(...chunks.map(c => c.similarity))

  if (bestScore >= 0.5) {
    return { confidence: 'high', needsRetry: false, message: '' }
  }

  if (bestScore >= 0.4) {
    return { confidence: 'medium', needsRetry: false, message: 'Good confidence' }
  }

  if (bestScore >= 0.25) {
    if (retryCount < MAX_RETRIES) {
      return { confidence: 'low', needsRetry: true, message: 'Average confidence' }
    }
    return { confidence: 'low', needsRetry: false, message: 'Average confidence' }
  }

  if (retryCount < MAX_RETRIES) {
    return { confidence: 'very_low', needsRetry: true, message: '' }
  }
  return { confidence: 'very_low', needsRetry: false, message: '' }
}
