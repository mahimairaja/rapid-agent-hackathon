import { useState } from 'react'
import { Check, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '../types'
import { toolLabel } from '../data/toolLabels'

interface ToolTrailProps {
  items: ChatMessage[]
}

/**
 * Maya's visible reasoning: consecutive tool calls from one turn grouped into
 * a collapsible activity trail (design borrowed from Vercel AI Elements'
 * Tool/ChainOfThought components, built on our own shadcn primitives since we
 * stream bridge frames rather than AI SDK messages).
 *
 * Open while running so the patient sees work happening; collapses to a
 * one-line summary once the turn's tools are done, unless the user pins it.
 */
export function ToolTrail({ items }: ToolTrailProps) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const running = items.some((m) => m.toolStatus === 'running')
  const open = userOpen ?? running

  const latest = items[items.length - 1]
  const summary = running
    ? toolLabel(latest.tool ?? '', 'running')
    : items.length === 1
      ? toolLabel(latest.tool ?? '', 'done')
      : `Checked ${items.length} things`

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => setUserOpen(next)}
      className="my-1.5 ml-11 w-fit max-w-full"
    >
      <CollapsibleTrigger
        className={cn(
          'flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5',
          'text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        )}
      >
        {running ? (
          <Loader2 className="size-3.5 animate-spin text-primary" />
        ) : (
          <CheckCircle2 className="size-3.5 text-secondary" />
        )}
        <span>{summary}</span>
        {items.length > 1 && (
          <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        )}
      </CollapsibleTrigger>
      {items.length > 1 && (
        <CollapsibleContent>
          <div className="ml-4 mt-1.5 flex flex-col gap-1 border-l border-border pl-3.5">
            {items.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                {m.toolStatus === 'running' ? (
                  <Loader2 className="size-3 animate-spin text-primary" />
                ) : (
                  <Check className="size-3 text-secondary" />
                )}
                <span>{toolLabel(m.tool ?? '', m.toolStatus ?? 'done')}</span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
