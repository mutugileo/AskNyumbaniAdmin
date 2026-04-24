'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ExternalLink, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubmissionMediaPreviewProps {
  urls: string[]
  emptyLabel?: string
  className?: string
}

function normalizeUrls(urls: string[]): string[] {
  const deduped = new Set<string>()
  urls.forEach(raw => {
    const value = raw.trim()
    if (!value) return
    if (!/^https?:\/\//i.test(value)) return
    deduped.add(value)
  })
  return Array.from(deduped)
}

export function SubmissionMediaPreview({
  urls,
  emptyLabel = 'No images attached',
  className,
}: SubmissionMediaPreviewProps) {
  const [expanded, setExpanded] = useState(false)
  const mediaUrls = useMemo(() => normalizeUrls(urls), [urls])

  if (mediaUrls.length === 0) {
    return (
      <div className={cn('rounded-lg border border-dashed border-border p-2.5 text-[11px] text-muted-foreground', className)}>
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2 rounded-lg border border-border p-2.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(prev => !prev)}
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
          <ImageIcon className="h-3 w-3" />
          Images ({mediaUrls.length})
        </button>
        <a
          href={mediaUrls[0]}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Open first
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 xl:grid-cols-4">
          {mediaUrls.map((url, index) => (
            <a
              key={`${url}-${index}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="group relative overflow-hidden rounded-lg border border-border bg-muted"
            >
              <img
                src={url}
                alt={`Submission image ${index + 1}`}
                className="h-20 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
              />
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 py-0.5 text-[9px] text-white tabular-nums">
                {index + 1}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
