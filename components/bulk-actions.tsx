'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    // This would need to be passed down from the parent component
    // For now, we'll just show the confirmation
    setShowConfirm(true)
  }

  if (showConfirm) {
    return (
      <Card className="border-primary animate-in fade-in zoom-in duration-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center animate-in slide-in-from-left duration-300 delay-100">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 animate-pulse" />
            Confirm Bulk Approval
          </CardTitle>
          <CardDescription className="animate-in fade-in duration-300 delay-200">
            Are you sure you want to approve {selectedCount} images? This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex space-x-3 animate-in slide-in-from-bottom duration-300 delay-300">
            <Button
              onClick={() => {
                // Handle bulk approval here
                setShowConfirm(false)
                onClear()
              }}
              className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md group"
              disabled={bulkApprove.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2 transition-transform group-hover:rotate-12" />
              Yes, Approve All
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              className="transition-all duration-200 hover:scale-105 hover:shadow-md"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-right duration-300">
      <span className="text-sm text-muted-foreground font-medium px-2 py-1 bg-primary/10 rounded-md animate-pulse">
        {selectedCount} selected
      </span>
      <Button
        size="sm"
        onClick={handleBulkApprove}
        className="bg-green-600 hover:bg-green-700 transition-all duration-200 hover:scale-105 hover:shadow-md group"
      >
        <CheckCircle className="h-4 w-4 mr-1 transition-transform group-hover:rotate-12" />
        Approve All
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onClear}
        className="transition-all duration-200 hover:scale-105 hover:shadow-md group"
      >
        <X className="h-4 w-4 mr-1 transition-transform group-hover:rotate-90" />
        Clear
      </Button>
    </div>
  )
}
