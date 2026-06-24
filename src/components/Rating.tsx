'use client'

import { useState } from 'react'

interface RatingProps {
  answerId: string | null
}

export default function Rating({ answerId }: RatingProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleRate(value: number) {
    setRating(value)
    setSubmitted(true)

    if (answerId) {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId, rating: value }),
      })
    }
  }

  if (submitted) {
    return <span className="text-xs text-gray-500">Rated {rating}/5</span>
  }

  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs text-gray-500">Rate:</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => handleRate(n)}
          onMouseEnter={() => setHoveredRating(n)}
          onMouseLeave={() => setHoveredRating(null)}
          className={`flex h-6 w-6 items-center justify-center rounded text-xs transition-colors ${
            (hoveredRating !== null ? n <= hoveredRating : false)
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-50 text-gray-500 hover:bg-indigo-50'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
