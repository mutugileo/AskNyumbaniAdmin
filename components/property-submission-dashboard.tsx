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

type StatusFilter = 'all' | PropertyStatus

function statusBadgeVariant(status: PropertyStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'available') return 'default'
  if (status === 'inactive') return 'destructive'
  return 'secondary'
}

function statusLabel(status: PropertyStatus): string {
  if (status === 'available') return 'approved'
  if (status === 'inactive') return 'rejected'
  return status
}

function safeLandSummary(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '-'
  const record = value as Record<string, unknown>
  const landType = typeof record.land_type === 'string' ? record.land_type : '-'
  const road = record.has_road_access === true
    ? String(record.road_access_type ?? 'yes')
    : 'no'
  return `Type: ${landType} • Road: ${road}`
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
    return {
      total: items.length,
      pending,
      approved,
      rejected,
    }
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
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not load property submissions</AlertTitle>
          <AlertDescription>
            {(query.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Total" value={stats.total} />
        <StatCard title="Pending" value={stats.pending} />
        <StatCard title="Approved" value={stats.approved} />
        <StatCard title="Rejected" value={stats.rejected} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/70 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Property moderation queue</h3>
            <p className="text-sm text-muted-foreground">Approve or reject vendor-submitted property and land listings.</p>
          </div>
          <div className="flex gap-2">
            <select
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="available">Approved</option>
              <option value="inactive">Rejected</option>
            </select>
            <Button type="button" size="icon" variant="outline" onClick={() => query.refetch()}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {query.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading property submissions...
            </div>
          )}

          {!query.isLoading && items.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              No property submissions found for this filter.
            </div>
          )}

          {items.map(item => {
            const isProcessing = approveMutation.isPending || rejectMutation.isPending

            return (
              <article
                key={item.id}
                className="space-y-4 rounded-2xl border border-border/70 bg-background/80 p-4 sm:p-5"
              >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-lg font-semibold">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.propertyType.toUpperCase()} • {item.dealType.toUpperCase()} • {item.city}, {item.county}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.isFeatured && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3.5 w-3.5" />
                          Featured
                        </Badge>
                      )}
                      <Badge variant={statusBadgeVariant(item.status)}>
                        {statusLabel(item.status)}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-3">
                    <div className="flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      Created {new Date(item.createdAt).toLocaleString()}
                    </div>
                    <div>{item.ownerName}</div>
                    <div>{item.ownerPhone || item.ownerEmail || 'No contact'}</div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                    <div><span className="text-muted-foreground">Price:</span> {item.currency} {item.price.toLocaleString()}</div>
                    <div><span className="text-muted-foreground">Address:</span> {item.address}</div>
                    <div>
                      <span className="text-muted-foreground">Images:</span> {item.imageCount}
                      {' '}({item.approvedImageCount} approved / {item.pendingImageCount} pending / {item.rejectedImageCount} rejected)
                    </div>
                  </div>

                  {item.propertyType === 'land' && (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Land details:</span>{' '}
                      {safeLandSummary(item.landDetails)}
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">{item.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {item.status === 'pending' && (
                      <>
                        <Button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => onApprove(item.id)}
                          className="gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={isProcessing}
                          onClick={() => onReject(item.id)}
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      variant={item.isFeatured ? 'secondary' : 'outline'}
                      disabled={item.status !== 'available' || featureMutation.isPending}
                      onClick={() => onToggleFeatured(item.id, !item.isFeatured)}
                      className="gap-2"
                    >
                      {item.isFeatured ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                      {item.isFeatured ? 'Unfeature' : 'Feature'}
                    </Button>
                    {item.status !== 'available' && (
                      <span className="text-xs text-muted-foreground self-center">
                        Approve property to feature.
                      </span>
                    )}
                  </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
