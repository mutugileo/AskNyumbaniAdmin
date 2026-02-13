'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageReviewModal } from '@/components/image-review-modal'
import { useApproveImage, useRejectImage } from '@/lib/hooks/use-image-reviews'
import { PropertyImage } from '@/lib/types/database'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  MapPin, 
  User, 
  Calendar,
  AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'

interface ImageReviewCardProps {
  image: PropertyImage & {
    property_title?: string
    property_address?: string
    property_city?: string
    property_owner_name?: string
    property_owner_email?: string
    property_owner_phone?: string
    reviewer_name?: string
    reviewer_email?: string
  }
  isSelected: boolean
  onSelect: (selected: boolean) => void
  showSelection?: boolean
}

export function ImageReviewCard({ 
  image, 
  isSelected, 
  onSelect, 
  showSelection = false 
}: ImageReviewCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [imageError, setImageError] = useState(false)
  
  const approveImage = useApproveImage()
  const rejectImage = useRejectImage()

  const getStatusBadge = () => {
    if (image.admin_approved === true) {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      )
    } else if (image.admin_approved === false) {
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      )
    } else {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      )
    }
  }

  const handleQuickApprove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const message = image.property_title ? `Approve image for "${image.property_title}"?` : 'Approve this image?'
    if (confirm(message)) {
      try {
        await approveImage.mutateAsync({
          imageId: image.id,
          propertyId: image.property_id,
          propertyTitle: image.property_title,
          imageUrl: image.image_url,
        })
      } catch (error) {
        console.error('Failed to approve image:', error)
        alert('Failed to approve image. Please try again.')
      }
    }
  }

  const handleQuickReject = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const reason = prompt('Please provide a reason for rejection (required):')
    if (reason && reason.trim()) {
      try {
        await rejectImage.mutateAsync({
          imageId: image.id,
          imageUrl: image.image_url,
          rejectionReason: reason.trim(),
          propertyId: image.property_id,
          propertyTitle: image.property_title,
        })
      } catch (error) {
        console.error('Failed to reject image:', error)
      }
    }
  }

  const isProcessing = approveImage.isPending || rejectImage.isPending

  return (
    <>
      <Card className={`
        relative transition-all duration-300 hover:shadow-md hover:scale-[1.02] hover:-translate-y-1
        ${isSelected ? 'ring-2 ring-primary ring-offset-2 shadow-md' : ''}
        ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        group
      `}>
        {/* Selection Checkbox */}
        {showSelection && (
          <div className="absolute top-3 left-3 z-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="bg-white/90 backdrop-blur-sm"
            />
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-3 right-3 z-10">
          {getStatusBadge()}
        </div>

        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-t-lg">
          {imageError ? (
            <div className="flex items-center justify-center h-full bg-muted">
              <AlertTriangle className="h-12 w-12 text-muted-foreground animate-pulse" />
            </div>
          ) : (
            <Image
              src={image.image_url}
              alt={image.caption || 'Property image'}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-110"
              onError={() => setImageError(true)}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            />
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
            <Button
              variant="secondary"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 hover:scale-105"
              onClick={() => setIsModalOpen(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Review
            </Button>
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-4 space-y-3">
          {/* Property Info */}
          <div>
            <h3 className="font-semibold text-sm text-foreground line-clamp-1">
              {image.property_title || 'Property Image'}
            </h3>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3 mr-1" />
              <span className="line-clamp-1">
                {image.property_address}, {image.property_city}
              </span>
            </div>
          </div>

          {/* Owner Info */}
          <div className="flex items-center text-xs text-muted-foreground">
            <User className="h-3 w-3 mr-1" />
            <span className="line-clamp-1">
              {image.property_owner_name || 'Unknown Owner'}
            </span>
          </div>

          {/* Upload Date */}
          <div className="flex items-center text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            <span>
              {format(new Date(image.created_at), 'MMM d, yyyy')}
            </span>
          </div>

          {/* Caption */}
          {image.caption && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {image.caption}
            </p>
          )}

          {/* Quick Actions for Pending Images */}
          {image.admin_approved === null && (
            <div className="mt-3 border-t border-border pt-3 flex gap-2">
              <Button
                size="sm"
                onClick={handleQuickApprove}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white transition-all duration-200 hover:scale-105 hover:shadow-md group/approve"
              >
                <CheckCircle className="h-3 w-3 mr-1 transition-transform group-hover/approve:rotate-12" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleQuickReject}
                disabled={isProcessing}
                className="flex-1 transition-all duration-200 hover:scale-105 hover:shadow-md group/reject"
              >
                <XCircle className="h-3 w-3 mr-1 transition-transform group-hover/reject:rotate-12" />
                Reject
              </Button>
            </div>
          )}

          {/* Review Info for Processed Images */}
          {image.admin_approved !== null && image.admin_reviewed_at && (
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Reviewed:</span>
                  <span>{format(new Date(image.admin_reviewed_at), 'MMM d, yyyy')}</span>
                </div>
                {image.reviewer_name && (
                  <div className="flex items-center justify-between mt-1">
                    <span>By:</span>
                    <span className="line-clamp-1">{image.reviewer_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rejection Reason */}
          {image.admin_approved === false && image.admin_rejection_reason && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-red-600 line-clamp-2">
                <strong>Reason:</strong> {image.admin_rejection_reason}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Modal */}
      <ImageReviewModal
        image={image}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
