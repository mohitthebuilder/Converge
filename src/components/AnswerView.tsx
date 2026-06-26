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
      <div className="mt-4 rounded-xl border border-border/40 bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Searching your tools for: <span className="font-medium text-foreground">{query}</span>
        </p>
        <div className="mt-5 flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:0ms]" />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:150ms]" />
          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/50 [animation-delay:300ms]" />
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
    <div className="mt-4 rounded-xl border border-border/40 bg-card p-6 shadow-sm">
      <div className="prose-converge">
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h2 className="mb-3 mt-5 text-base font-semibold tracking-tight text-foreground first:mt-0">{children}</h2>,
            h2: ({ children }) => <h3 className="mb-2 mt-4 text-[15px] font-semibold tracking-tight text-foreground first:mt-0">{children}</h3>,
            h3: ({ children }) => <h4 className="mb-2 mt-3 text-sm font-semibold text-foreground first:mt-0">{children}</h4>,
            p: ({ children }) => <p className="mb-3 text-[15px] leading-[1.8] text-foreground last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
            ul: ({ children }) => <ul className="mb-3 ml-1 space-y-1.5">{children}</ul>,
            ol: ({ children }) => <ol className="mb-3 ml-1 list-decimal space-y-1.5 pl-4">{children}</ol>,
            li: ({ children }) => (
              <li className="flex gap-2 text-[15px] leading-[1.8] text-foreground">
                <span className="mt-[13px] h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                <span>{children}</span>
              </li>
            ),
            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">{children}</a>,
            blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-primary/20 pl-4 text-muted-foreground">{children}</blockquote>,
            code: ({ children }) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">{children}</code>,
          }}
        >
          {cleaned}
        </ReactMarkdown>
      </div>
      {isStreaming && (
        <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-primary/30 align-text-bottom" />
      )}
    </div>
  )
}
