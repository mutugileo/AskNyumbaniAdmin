'use client'

import { useAdminActivityLog } from '@/lib/hooks/use-image-reviews'
import { formatDistanceToNow } from 'date-fns'
import { Activity, CheckCircle, Loader2, Route, XCircle, Image } from 'lucide-react'

const activityIconMap: Record<string, JSX.Element> = {
  image_approved: <CheckCircle className="h-3.5 w-3.5 text-success" />,
  image_rejected: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  bulk_image_approved: <Image className="h-3.5 w-3.5 text-primary" />,
  relocation_submission_created: <Route className="h-3.5 w-3.5 text-primary" />,
  relocation_submission_approved: <CheckCircle className="h-3.5 w-3.5 text-success" />,
  relocation_submission_rejected: <XCircle className="h-3.5 w-3.5 text-destructive" />,
  marketplace_submission_created: <Route className="h-3.5 w-3.5 text-primary" />,
  marketplace_submission_approved: <CheckCircle className="h-3.5 w-3.5 text-success" />,
  marketplace_submission_rejected: <XCircle className="h-3.5 w-3.5 text-destructive" />,
}

function ActivityIcon({ type }: { type: string }) {
  return activityIconMap[type] ?? <Activity className="h-3.5 w-3.5 text-muted-foreground" />
}

export function AdminActivityLog() {
  const { data, isLoading, error } = useAdminActivityLog(8)

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Recent Activity</h3>
      </div>

      <div className="p-3">
        {isLoading && (
          <div className="flex flex-col items-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs">Loading activity...</span>
          </div>
        )}

        {error && (
          <div className="py-6 px-2 text-xs text-destructive">
            Unable to load activity log.
          </div>
        )}

        {!isLoading && !error && (!data || data.length === 0) && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No recent admin activity recorded yet.
          </div>
        )}

        {data && data.length > 0 && (
          <div className="space-y-1.5">
            {data.map((log) => {
              const metadata = (log.metadata ?? {}) as Record<string, unknown>
              const propertyTitle = (metadata.propertyTitle as string) || ''
              const propertyId = (metadata.propertyId as string) || ''
              const rejectionReason = metadata.rejectionReason as string | undefined

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted/50"
                >
                  <div className="mt-0.5 shrink-0">
                    <ActivityIcon type={log.activity_type} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-xs font-medium text-foreground leading-snug">
                      {log.description ?? log.activity_type.replace(/_/g, ' ')}
                    </p>
                    {(propertyTitle || propertyId) && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {propertyTitle || `Property: ${propertyId}`}
                      </p>
                    )}
                    {rejectionReason && (
                      <p className="text-[11px] text-destructive truncate">
                        Reason: {rejectionReason}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
