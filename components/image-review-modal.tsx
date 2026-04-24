'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useApproveImage, useRejectImage } from '@/lib/hooks/use-image-reviews'
import { PropertyImage } from '@/lib/types/database'
import {
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  User,
  Calendar,
  AlertTriangle,
  X
} from 'lucide-react'
import { format } from 'date-fns'

interface ImageReviewModalProps {
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
  isOpen: boolean
  onClose: () => void
}

export function ImageReviewModal({ image, isOpen, onClose }: ImageReviewModalProps) {
  const [rejectionReason, setRejectionReason] = useState('')
  const [imageError, setImageError] = useState(false)

  const approveImage = useApproveImage()
  const rejectImage = useRejectImage()

  const handleApprove = async () => {
    try {
      await approveImage.mutateAsync({
        imageId: image.id,
        propertyId: image.property_id,
        propertyTitle: image.property_title,
        imageUrl: image.image_url,
      })
      onClose()
    } catch (error) {
      console.error('Failed to approve image:', error)
      alert('Failed to approve image. Please try again.')
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection')
      return
    }

    try {
      await rejectImage.mutateAsync({
        imageId: image.id,
        imageUrl: image.image_url,
        rejectionReason: rejectionReason.trim(),
        propertyId: image.property_id,
        propertyTitle: image.property_title,
      })
      onClose()
    } catch (error) {
      console.error('Failed to reject image:', error)
      alert('Failed to reject image. Please try again.')
    }
  }

  const statusBadge = () => {
    if (image.admin_approved === true) {
      return (
        <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
          <CheckCircle className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      )
    } else if (image.admin_approved === false) {
      return (
        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
          <Clock className="h-3 w-3 mr-1" />
          Pending Review
        </Badge>
      )
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Image Review</h2>
            <p className="text-xs text-muted-foreground">Review property image for approval</p>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge()}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Image */}
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
            {imageError ? (
              <div className="flex items-center justify-center h-full">
                <AlertTriangle className="h-14 w-14 text-muted-foreground/30" />
              </div>
            ) : (
              <Image
                src={image.image_url}
                alt={image.caption || 'Property image'}
                fill
                className="object-contain"
                onError={() => setImageError(true)}
                sizes="(max-width: 768px) 100vw, 80vw"
              />
            )}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Property Details</h3>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{image.property_title || 'Property Image'}</p>
                    <p className="text-xs text-muted-foreground">{image.property_address}, {image.property_city}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{image.property_owner_name || 'Unknown Owner'}</p>
                    <p className="text-xs text-muted-foreground">{image.property_owner_email}</p>
                    {image.property_owner_phone && (
                      <p className="text-xs text-muted-foreground">{image.property_owner_phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Uploaded</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(image.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Image Details</h3>
              <div className="space-y-2.5">
                <DetailRow label="Caption" value={image.caption || 'No caption provided'} />
                <DetailRow label="Display Order" value={String(image.display_order)} />
                <DetailRow label="Primary Image" value={image.is_primary ? 'Yes' : 'No'} />
                {image.admin_rejection_reason && (
                  <div>
                    <p className="text-xs font-medium text-destructive">Rejection Reason</p>
                    <p className="text-xs text-destructive/80">{image.admin_rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Review actions */}
          {image.admin_approved === null && (
            <div className="space-y-4 border-t border-border pt-4">
              <Button
                onClick={handleApprove}
                disabled={approveImage.isPending || rejectImage.isPending}
                className="bg-success text-success-foreground hover:bg-success/90 shadow-sm"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {approveImage.isPending ? 'Approving...' : 'Approve Image'}
              </Button>

              <div className="border-t border-border pt-4 space-y-2">
                <label className="text-xs font-medium text-destructive">Reject with Reason (Required)</label>
                <Textarea
                  placeholder="Provide a reason for rejecting this image..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="border-destructive/20 focus:border-destructive/40"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={rejectImage.isPending || approveImage.isPending || !rejectionReason.trim()}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {rejectImage.isPending ? 'Rejecting...' : 'Reject & Delete Image'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={rejectImage.isPending || approveImage.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Review history */}
          {image.admin_approved !== null && image.admin_reviewed_at && (
            <div className="border-t border-border pt-4 space-y-2">
              <h3 className="text-sm font-semibold">Review History</h3>
              <div className="rounded-lg bg-muted/50 p-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <DetailRow label="Reviewed On" value={format(new Date(image.admin_reviewed_at), "MMM d, yyyy 'at' h:mm a")} />
                {image.reviewer_name && <DetailRow label="Reviewed By" value={image.reviewer_name} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-xs text-foreground">{value}</p>
    </div>
  )
}
