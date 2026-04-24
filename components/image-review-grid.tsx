'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EnhancedImageReviewCard } from '@/components/enhanced-image-review-card'
import { BulkActions } from '@/components/bulk-actions'
import { usePendingImageReviews, useImageReviewHistory } from '@/lib/hooks/use-image-reviews'
import { Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface ImageReviewGridProps {
  filter: 'pending' | 'approved' | 'all'
}

export function ImageReviewGrid({ filter }: ImageReviewGridProps) {
  const [selectedImages, setSelectedImages] = useState<string[]>([])

  const {
    data: pendingImages,
    isLoading: pendingLoading,
    error: pendingError
  } = usePendingImageReviews()

  const {
    data: reviewHistory,
    isLoading: historyLoading,
    error: historyError
  } = useImageReviewHistory()

  const isLoading = pendingLoading || historyLoading
  const error = pendingError || historyError

  const getFilteredImages = () => {
    if (filter === 'pending') {
      return pendingImages || []
    } else if (filter === 'approved') {
      return (reviewHistory || []).filter(img => img.admin_approved === true)
    } else {
      return [...(pendingImages || []), ...((reviewHistory || []).filter(img => img.admin_approved === true))]
    }
  }

  const filteredImages = getFilteredImages()

  const handleImageSelect = (imageId: string, selected: boolean) => {
    if (selected) {
      setSelectedImages(prev => [...prev, imageId])
    } else {
      setSelectedImages(prev => prev.filter(id => id !== imageId))
    }
  }

  const handleSelectAll = () => {
    if (selectedImages.length === filteredImages.length) {
      setSelectedImages([])
    } else {
      setSelectedImages(filteredImages.map(img => img.id))
    }
  }

  const clearSelection = () => {
    setSelectedImages([])
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
        <h3 className="text-sm font-semibold mb-1">Error Loading Images</h3>
        <p className="text-xs text-muted-foreground mb-4">
          There was an error loading the image data. Please try again.
        </p>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading images...</p>
      </div>
    )
  }

  if (filteredImages.length === 0) {
    const emptyStates = {
      pending: { icon: CheckCircle, title: 'No Pending Reviews', desc: 'All images have been reviewed. Great job!', color: 'text-success' },
      approved: { icon: CheckCircle, title: 'No Approved Images', desc: 'No images have been approved yet.', color: 'text-muted-foreground' },
      all: { icon: Clock, title: 'No Images Found', desc: 'No property images available for review.', color: 'text-muted-foreground' },
    }
    const state = emptyStates[filter]
    const EmptyIcon = state.icon

    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <EmptyIcon className={`h-10 w-10 ${state.color} mx-auto mb-3`} />
        <h3 className="text-sm font-semibold mb-1">{state.title}</h3>
        <p className="text-xs text-muted-foreground">{state.desc}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk header */}
      {filter === 'pending' && filteredImages.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div>
            <p className="text-sm font-semibold">Pending Image Reviews ({filteredImages.length})</p>
            <p className="text-xs text-muted-foreground">Review and approve property images before they appear in the app</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll} className="text-xs">
              {selectedImages.length === filteredImages.length ? 'Deselect All' : 'Select All'}
            </Button>
            {selectedImages.length > 0 && (
              <BulkActions selectedCount={selectedImages.length} onClear={clearSelection} />
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredImages.map((image) => (
          <EnhancedImageReviewCard
            key={image.id}
            image={image}
            isSelected={selectedImages.includes(image.id)}
            onSelect={(selected) => handleImageSelect(image.id, selected)}
            showSelection={filter === 'pending'}
          />
        ))}
      </div>

      {filteredImages.length >= 20 && (
        <div className="text-center pt-2">
          <Button variant="outline" size="sm">Load More Images</Button>
        </div>
      )}
    </div>
  )
}
