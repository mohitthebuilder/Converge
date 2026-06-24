'use client'

interface AnswerViewProps {
  answer: string
  isStreaming: boolean
  query: string
}

export default function AnswerView({ answer, isStreaming, query }: AnswerViewProps) {
  if (!answer && isStreaming) {
    return (
      <div className="py-8">
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
    .replace(/\n\n/g, '</p><p class="mt-4">')
    .replace(/\n- /g, '</p><li class="ml-5 mt-1.5 list-disc text-[15px]">')
    .replace(/\n/g, '<br/>')
    .replace(
      /\[(\d+)\]/g,
      '<sup class="inline-flex items-center justify-center ml-0.5 cursor-default"><span class="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-primary/10 px-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/20">$1</span></sup>'
    )

  return (
    <div className="py-6">
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
