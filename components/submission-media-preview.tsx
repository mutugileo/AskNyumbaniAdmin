'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ExternalLink, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
      <div className={cn('rounded-md border border-dashed p-3 text-xs text-muted-foreground', className)}>
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2 rounded-md border p-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => setExpanded(prev => !prev)}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          <ImageIcon className="h-3.5 w-3.5" />
          Images ({mediaUrls.length})
        </Button>
        <a
          href={mediaUrls[0]}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Open first
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {mediaUrls.map((url, index) => (
            <a
              key={`${url}-${index}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="group relative overflow-hidden rounded-md border bg-muted"
            >
              <img
                src={url}
                alt={`Submission image ${index + 1}`}
                className="h-24 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                {index + 1}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
