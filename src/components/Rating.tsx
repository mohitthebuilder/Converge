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
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <svg key={n} className={`h-3.5 w-3.5 ${n <= (rating || 0) ? 'text-amber-400' : 'text-gray-200'}`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="ml-1 text-[11px] text-muted-foreground">Thanks!</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5">
      <span className="mr-1.5 text-[11px] text-muted-foreground/50">Rate this answer</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => handleRate(n)}
          onMouseEnter={() => setHoveredRating(n)}
          onMouseLeave={() => setHoveredRating(null)}
          className="cursor-pointer p-0.5 transition-transform hover:scale-110"
        >
          <svg className={`h-4 w-4 transition-colors ${
            n <= (hoveredRating || 0) ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'
          }`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  )
}
