'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EnhancedImageReviewCard } from '@/components/enhanced-image-review-card'
import { BulkActions } from '@/components/bulk-actions'
import { usePendingImageReviews, useImageReviewHistory } from '@/lib/hooks/use-image-reviews'
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

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

  // Filter images based on current filter
  const getFilteredImages = () => {
    if (filter === 'pending') {
      return pendingImages || []
    } else if (filter === 'approved') {
      return (reviewHistory || []).filter(img => img.admin_approved === true)
    } else {
      // 'all' - show both pending and approved (rejected images are deleted)
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
      <Card className="animate-in fade-in zoom-in duration-500">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold text-foreground mb-2 animate-in slide-in-from-top duration-300 delay-100">
            Error Loading Images
          </h3>
          <p className="text-muted-foreground mb-4 animate-in fade-in duration-300 delay-200">
            There was an error loading the image data. Please try again.
          </p>
          <Button onClick={() => window.location.reload()} className="animate-in slide-in-from-bottom duration-300 delay-300 hover:scale-105 transition-transform">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className="animate-in fade-in zoom-in duration-500">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <Clock className="h-8 w-8 animate-spin text-primary" />
              <div className="absolute inset-0 h-8 w-8 animate-ping text-primary opacity-20">
                <Clock className="h-8 w-8" />
              </div>
            </div>
            <span className="text-muted-foreground animate-pulse">Loading images...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (filteredImages.length === 0) {
    const getEmptyMessage = () => {
      switch (filter) {
        case 'pending':
          return {
            icon: CheckCircle,
            title: 'No Pending Reviews',
            description: 'All images have been reviewed. Great job!',
            color: 'text-green-600'
          }
        case 'approved':
          return {
            icon: CheckCircle,
            title: 'No Approved Images',
            description: 'No images have been approved yet.',
            color: 'text-muted-foreground'
          }
        default:
          return {
            icon: Clock,
            title: 'No Images Found',
            description: 'No property images available for review.',
            color: 'text-muted-foreground'
          }
      }
    }

    const emptyState = getEmptyMessage()
    const EmptyIcon = emptyState.icon

    return (
      <Card className="animate-in fade-in zoom-in duration-500">
        <CardContent className="p-8 text-center">
          <EmptyIcon className={`h-12 w-12 ${emptyState.color} mx-auto mb-4 animate-in zoom-in duration-300`} />
          <h3 className="text-lg font-semibold text-foreground mb-2 animate-in slide-in-from-top duration-300 delay-100">
            {emptyState.title}
          </h3>
          <p className="text-muted-foreground animate-in fade-in duration-300 delay-200">
            {emptyState.description}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with bulk actions */}
      {filter === 'pending' && filteredImages.length > 0 && (
        <Card className="animate-in fade-in slide-in-from-top duration-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  Pending Image Reviews ({filteredImages.length})
                </CardTitle>
                <CardDescription>
                  Review and approve property images before they appear in the app
                </CardDescription>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={handleSelectAll}
                  className="text-sm transition-all duration-200 hover:scale-105 hover:shadow-md"
                >
                  {selectedImages.length === filteredImages.length ? 'Deselect All' : 'Select All'}
                </Button>
                {selectedImages.length > 0 && (
                  <div className="animate-in fade-in slide-in-from-right duration-300">
                    <BulkActions
                      selectedCount={selectedImages.length}
                      onClear={clearSelection}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Image Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredImages.map((image, index) => (
          <div
            key={image.id}
            className="animate-in fade-in zoom-in duration-500"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <EnhancedImageReviewCard
              image={image}
              isSelected={selectedImages.includes(image.id)}
              onSelect={(selected) => handleImageSelect(image.id, selected)}
              showSelection={filter === 'pending'}
            />
          </div>
        ))}
      </div>

      {/* Load More Button (if needed) */}
      {filteredImages.length >= 20 && (
        <div className="text-center animate-in fade-in slide-in-from-bottom duration-500">
          <Button variant="outline" size="lg" className="transition-all duration-200 hover:scale-105 hover:shadow-md">
            Load More Images
          </Button>
        </div>
      )}
    </div>
  )
}
