'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useBulkApproveImages } from '@/lib/hooks/use-image-reviews'
import { CheckCircle, X, AlertTriangle } from 'lucide-react'

interface BulkActionsProps {
  selectedCount: number
  onClear: () => void
}

export function BulkActions({ selectedCount, onClear }: BulkActionsProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const bulkApprove = useBulkApproveImages()

  const handleBulkApprove = async () => {
    setShowConfirm(true)
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
        <p className="text-xs text-foreground">
          Approve <strong>{selectedCount}</strong> images?
        </p>
        <Button
          size="sm"
          onClick={() => {
            setShowConfirm(false)
            onClear()
          }}
          className="h-7 text-[11px] bg-success text-success-foreground hover:bg-success/90"
          disabled={bulkApprove.isPending}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Confirm
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowConfirm(false)}
          className="h-7 text-[11px]"
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-primary font-medium tabular-nums">
        {selectedCount} selected
      </span>
      <Button
        size="sm"
        onClick={handleBulkApprove}
        className="h-7 text-[11px] gap-1 bg-success text-success-foreground hover:bg-success/90"
      >
        <CheckCircle className="h-3 w-3" />
        Approve All
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onClear}
        className="h-7 text-[11px] gap-1 text-muted-foreground"
      >
        <X className="h-3 w-3" />
        Clear
      </Button>
    </div>
  )
}
