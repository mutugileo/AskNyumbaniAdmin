'use client'

import { useState } from 'react'
import Image from 'next/image'
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
  AlertTriangle,
  MessageSquare,
  Star
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface EnhancedImageReviewCardProps {
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

export function EnhancedImageReviewCard({
  image,
  isSelected,
  onSelect,
  showSelection = false
}: EnhancedImageReviewCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [imageError, setImageError] = useState(false)

  const approveImage = useApproveImage()
  const rejectImage = useRejectImage()

  const statusBadge = () => {
    if (image.admin_approved === true) {
      return (
        <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">
          <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
          Approved
        </Badge>
      )
    } else if (image.admin_approved === false) {
      return (
        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
          <XCircle className="h-2.5 w-2.5 mr-0.5" />
          Rejected
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">
          <Clock className="h-2.5 w-2.5 mr-0.5" />
          Pending
        </Badge>
      )
    }
  }

  const handleQuickApprove = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const message = image.property_title ? `Approve image for "${image.property_title}"?` : 'Approve this image?'
    if (!confirm(message)) return
    try {
      await approveImage.mutateAsync({
        imageId: image.id,
        propertyId: image.property_id,
        propertyTitle: image.property_title,
        imageUrl: image.image_url,
      })
    } catch (error) {
      console.error('Failed to approve image:', error)
    }
  }

  const handleQuickReject = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const reason = prompt('Please provide a reason for rejection:')
    if (reason && reason.trim()) {
      try {
        await rejectImage.mutateAsync({
          imageId: image.id,
          rejectionReason: reason.trim(),
          imageUrl: image.image_url,
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
      <div
        className={cn(
          'group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200',
          isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          isProcessing && 'opacity-50 pointer-events-none'
        )}
      >
        {/* Selection */}
        {showSelection && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              className="bg-black/50 backdrop-blur-sm border-white/30"
            />
          </div>
        )}

        {/* Status */}
        <div className="absolute top-2.5 right-2.5 z-10">
          {statusBadge()}
        </div>

        {/* Primary badge */}
        {image.is_primary && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10">
            <Badge variant="outline" className="border-primary/40 bg-primary/20 text-primary text-[10px]">
              <Star className="h-2.5 w-2.5 mr-0.5" />
              Primary
            </Badge>
          </div>
        )}

        {/* Image */}
        <div className="relative aspect-square overflow-hidden">
          {imageError ? (
            <div className="flex items-center justify-center h-full bg-muted">
              <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
            </div>
          ) : (
            <Image
              src={image.image_url}
              alt={image.caption || 'Property image'}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            />
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
            <Button
              variant="secondary"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs"
              onClick={() => setIsModalOpen(true)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Review
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          <h3 className="text-xs font-semibold line-clamp-1">{image.property_title || 'Property Image'}</h3>

          <div className="space-y-1">
            <div className="flex items-center text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 mr-1 shrink-0" />
              <span className="line-clamp-1">{image.property_address}, {image.property_city}</span>
            </div>
            <div className="flex items-center text-[11px] text-muted-foreground">
              <User className="h-3 w-3 mr-1 shrink-0" />
              <span className="line-clamp-1">{image.property_owner_name || 'Unknown Owner'}</span>
            </div>
            <div className="flex items-center text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3 mr-1 shrink-0" />
              <span>{format(new Date(image.created_at), 'MMM d, yyyy')}</span>
            </div>
          </div>

          {image.caption && (
            <div className="pt-1.5 border-t border-border">
              <p className="text-[11px] text-muted-foreground line-clamp-2">{image.caption}</p>
            </div>
          )}

          {image.admin_comment && (
            <div className="pt-1.5 border-t border-border flex items-start gap-1.5">
              <MessageSquare className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                <span className="font-medium">Admin:</span> {image.admin_comment}
              </p>
            </div>
          )}

          {/* Actions for pending */}
          {image.admin_approved === null && (
            <div className="pt-2 border-t border-border flex gap-2">
              <Button
                size="sm"
                onClick={handleQuickApprove}
                disabled={isProcessing}
                className="flex-1 h-8 text-[11px] bg-success text-success-foreground hover:bg-success/90"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleQuickReject}
                disabled={isProcessing}
                className="flex-1 h-8 text-[11px]"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </div>
          )}

          {/* Review info */}
          {image.admin_approved !== null && image.admin_reviewed_at && (
            <div className="pt-1.5 border-t border-border text-[11px] text-muted-foreground space-y-0.5">
              <div className="flex items-center justify-between">
                <span>Reviewed:</span>
                <span>{format(new Date(image.admin_reviewed_at), 'MMM d, yyyy')}</span>
              </div>
              {image.reviewer_name && (
                <div className="flex items-center justify-between">
                  <span>By:</span>
                  <span className="line-clamp-1">{image.reviewer_name}</span>
                </div>
              )}
            </div>
          )}

          {image.admin_approved === false && image.admin_rejection_reason && (
            <div className="pt-1.5 border-t border-border">
              <p className="text-[11px] text-destructive line-clamp-2">
                <strong>Reason:</strong> {image.admin_rejection_reason}
              </p>
            </div>
          )}
        </div>
      </div>

      <ImageReviewModal
        image={image}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
