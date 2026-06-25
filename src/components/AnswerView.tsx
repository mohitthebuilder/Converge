'use client'

interface AnswerViewProps {
  answer: string
  isStreaming: boolean
  query: string
}

export default function AnswerView({ answer, isStreaming, query }: AnswerViewProps) {
  if (!answer && isStreaming) {
    return (
      <div className="mt-4 rounded-xl border border-border/40 bg-white p-6 shadow-sm">
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

  const formatted = answer
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(\d+)\]/g, '')
    .replace(/\n\n/g, '</p><p class="mt-3">')
    .replace(/\n• /g, '</p><li class="ml-5 mt-1.5 list-disc text-[15px] leading-relaxed">')
    .replace(/\n- /g, '</p><li class="ml-5 mt-1.5 list-disc text-[15px] leading-relaxed">')
    .replace(/\n/g, '<br/>')

  return (
    <div className="mt-4 rounded-xl border border-border/40 bg-white p-6 shadow-sm">
      <div
        className="text-[15px] leading-[1.85] text-foreground/90 [&_li]:text-foreground/90 [&_strong]:font-semibold [&_strong]:text-foreground"
        dangerouslySetInnerHTML={{ __html: `<p>${formatted}</p>` }}
      />
      {isStreaming && (
        <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-primary/30 align-text-bottom" />
      )}
    </div>
  )
}
