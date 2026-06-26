'use client'

import ReactMarkdown from 'react-markdown'

interface AnswerViewProps {
  answer: string
  isStreaming: boolean
  query: string
}

export default function AnswerView({ answer, isStreaming, query }: AnswerViewProps) {
  if (!answer && isStreaming) {
    return (
      <div className="mt-6">
        <p className="text-[15px] text-muted-foreground">
          Searching your tools for <span className="font-medium text-foreground">{query}</span>
        </p>
        <div className="mt-4 flex items-center gap-2.5">
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-sm font-semibold tracking-wide text-transparent animate-pulse">
            Converging
          </span>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
            <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/30 [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    )
  }

  if (!answer) return null

  const cleaned = answer
    .replace(/\n*-{2,}\n*Sources?:[\s\S]*$/i, '')
    .replace(/\n*Sources?:\s*\n[\s\S]*$/i, '')
    .replace(/\[(\d+)\]/g, '')
    .trim()

  return (
    <div className="mt-5">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <p className="mb-3 mt-6 text-[15px] leading-[1.75] text-foreground first:mt-0"><strong className="font-semibold">{children}</strong></p>,
          h2: ({ children }) => <p className="mb-2 mt-5 text-[15px] leading-[1.75] text-foreground first:mt-0"><strong className="font-semibold">{children}</strong></p>,
          h3: ({ children }) => <p className="mb-2 mt-4 text-[15px] leading-[1.75] text-foreground first:mt-0"><strong className="font-semibold">{children}</strong></p>,
          p: ({ children }) => <p className="mb-3 text-[15px] leading-[1.75] text-foreground last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground">{children}</em>,
          ul: ({ children }) => <ul className="mb-4 space-y-2 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 list-decimal space-y-2 pl-5 marker:text-muted-foreground">{children}</ol>,
          li: ({ children }) => (
            <li className="flex gap-2.5 text-[15px] leading-[1.75] text-foreground">
              <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
              <span className="flex-1">{children}</span>
            </li>
          ),
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary">{children}</a>,
          blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-primary/30 pl-4 text-foreground/80">{children}</blockquote>,
          code: ({ children }) => <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">{children}</code>,
        }}
      >
        {cleaned}
      </ReactMarkdown>
      {isStreaming && (
        <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-primary align-text-bottom" />
      )}
    </div>
  )
}
