'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Loader2, RefreshCcw, Star, StarOff, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  PropertyStatus,
  useApprovePropertySubmission,
  useSetPropertyFeatured,
  usePropertySubmissions,
  useRejectPropertySubmission,
} from '@/lib/hooks/use-property-submissions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | PropertyStatus

function statusBadgeClasses(status: PropertyStatus): string {
  if (status === 'available') return 'bg-success/10 text-success border-success/20'
  if (status === 'inactive') return 'bg-destructive/10 text-destructive border-destructive/20'
  return 'bg-warning/10 text-warning border-warning/20'
}

function statusLabel(status: PropertyStatus): string {
  if (status === 'available') return 'Approved'
  if (status === 'inactive') return 'Rejected'
  return status
}

function safeLandSummary(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '-'
  const record = value as Record<string, unknown>
  const landType = typeof record.land_type === 'string' ? record.land_type : '-'
  const road = record.has_road_access === true
    ? String(record.road_access_type ?? 'yes')
    : 'no'
  return `Type: ${landType} \u00b7 Road: ${road}`
}

export function PropertySubmissionDashboard() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const query = usePropertySubmissions(statusFilter)
  const approveMutation = useApprovePropertySubmission()
  const rejectMutation = useRejectPropertySubmission()
  const featureMutation = useSetPropertyFeatured()

  const items = query.data ?? []
  const stats = useMemo(() => {
    const pending = items.filter(item => item.status === 'pending').length
    const approved = items.filter(item => item.status === 'available').length
    const rejected = items.filter(item => item.status === 'inactive').length
    return { total: items.length, pending, approved, rejected }
  }, [items])

  const onApprove = async (propertyId: string) => {
    try {
      await approveMutation.mutateAsync({ propertyId })
      toast.success('Property approved and published.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval failed')
    }
  }

  const onReject = async (propertyId: string) => {
    const reason = prompt('Provide a rejection reason (required):')
    if (!reason || !reason.trim()) {
      toast.error('Rejection reason is required.')
      return
    }

    try {
      await rejectMutation.mutateAsync({ propertyId, reason: reason.trim() })
      toast.success('Property rejected.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Rejection failed')
    }
  }

  const onToggleFeatured = async (propertyId: string, nextValue: boolean) => {
    try {
      await featureMutation.mutateAsync({ propertyId, isFeatured: nextValue })
      toast.success(nextValue ? 'Property marked as featured.' : 'Featured flag removed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update featured flag')
    }
  }

  return (
    <div className="space-y-6">
      {query.error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load property submissions</AlertTitle>
          <AlertDescription>{(query.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {/* Stats row */}
      <div className="stagger-children grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total" value={stats.total} color="text-foreground" />
        <StatCard label="Pending" value={stats.pending} color="text-warning" />
        <StatCard label="Approved" value={stats.approved} color="text-success" />
        <StatCard label="Rejected" value={stats.rejected} color="text-destructive" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Property moderation queue</h3>
          <p className="text-xs text-muted-foreground">Approve or reject vendor-submitted property and land listings.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="available">Approved</option>
            <option value="inactive">Rejected</option>
          </select>
          <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-lg" onClick={() => query.refetch()}>
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {query.isLoading && (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading property submissions...
          </div>
        )}

        {!query.isLoading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No property submissions found for this filter.
          </div>
        )}

        {items.map(item => {
          const isProcessing = approveMutation.isPending || rejectMutation.isPending

          return (
            <article
              key={item.id}
              className={cn(
                'mod-card space-y-4',
                item.status === 'pending' && 'mod-card--pending',
                item.status === 'available' && 'mod-card--published'
              )}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-base font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.propertyType.toUpperCase()} \u00b7 {item.dealType.toUpperCase()} \u00b7 {item.city}, {item.county}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.isFeatured && (
                    <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-primary text-[11px]">
                      <Star className="h-3 w-3" />
                      Featured
                    </Badge>
                  )}
                  <Badge variant="outline" className={cn('text-[11px]', statusBadgeClasses(item.status))}>
                    {statusLabel(item.status)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground md:grid-cols-3">
                <div className="flex items-center gap-1.5">
                  <Clock3 className="h-3 w-3" />
                  Created {new Date(item.createdAt).toLocaleString()}
                </div>
                <div>{item.ownerName}</div>
                <div>{item.ownerPhone || item.ownerEmail || 'No contact'}</div>
              </div>

              <div className="grid grid-cols-1 gap-1.5 text-xs md:grid-cols-3">
                <div><span className="text-muted-foreground">Price:</span> {item.currency} {item.price.toLocaleString()}</div>
                <div><span className="text-muted-foreground">Address:</span> {item.address}</div>
                <div>
                  <span className="text-muted-foreground">Images:</span> {item.imageCount}
                  {' '}({item.approvedImageCount} approved / {item.pendingImageCount} pending / {item.rejectedImageCount} rejected)
                </div>
              </div>

              {item.propertyType === 'land' && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Land details:</span>{' '}
                  {safeLandSummary(item.landDetails)}
                </div>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {item.status === 'pending' && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => onApprove(item.id)}
                      className="gap-1.5 bg-success text-success-foreground hover:bg-success/90 shadow-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isProcessing}
                      onClick={() => onReject(item.id)}
                      className="gap-1.5 shadow-sm"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={item.status !== 'available' || featureMutation.isPending}
                  onClick={() => onToggleFeatured(item.id, !item.isFeatured)}
                  className="gap-1.5"
                >
                  {item.isFeatured ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
                  {item.isFeatured ? 'Unfeature' : 'Feature'}
                </Button>
                {item.status !== 'available' && (
                  <span className="text-[11px] text-muted-foreground/60 self-center">
                    Approve property to feature.
                  </span>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat-card rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tracking-tight', color)}>{value}</p>
    </div>
  )
}
