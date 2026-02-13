'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAdminActivityLog } from '@/lib/hooks/use-image-reviews'
import { formatDistanceToNow } from 'date-fns'
import { Activity, CheckCircle, Loader2, Route, XCircle, Image } from 'lucide-react'

const activityIconMap: Record<string, JSX.Element> = {
  image_approved: <CheckCircle className="h-4 w-4 text-green-600" />,
  image_rejected: <XCircle className="h-4 w-4 text-red-600" />,
  bulk_image_approved: <Image className="h-4 w-4 text-primary" />,
  relocation_submission_created: <Route className="h-4 w-4 text-primary" />,
  relocation_submission_approved: <CheckCircle className="h-4 w-4 text-green-600" />,
  relocation_submission_rejected: <XCircle className="h-4 w-4 text-red-600" />,
  marketplace_submission_created: <Route className="h-4 w-4 text-primary" />,
  marketplace_submission_approved: <CheckCircle className="h-4 w-4 text-green-600" />,
  marketplace_submission_rejected: <XCircle className="h-4 w-4 text-red-600" />,
}

function ActivityIcon({ type }: { type: string }) {
  return activityIconMap[type] ?? <Activity className="h-4 w-4 text-muted-foreground" />
}

export function AdminActivityLog() {
  const { data, isLoading, error } = useAdminActivityLog(8)

  const content = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-3">
          <div className="relative">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div className="absolute inset-0 h-6 w-6 animate-ping text-primary opacity-20">
              <Loader2 className="h-6 w-6" />
            </div>
          </div>
          <span className="animate-pulse">Loading activity...</span>
        </div>
      )
    }

    if (error) {
      return (
        <div className="py-6 text-sm text-red-600 animate-in fade-in duration-300">
          Unable to load activity log. Please try again later.
        </div>
      )
    }

    if (!data || data.length === 0) {
      return (
        <div className="py-6 text-sm text-muted-foreground animate-in fade-in duration-300">
          No recent admin activity recorded yet.
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {data.map((log, index) => {
          const metadata = (log.metadata ?? {}) as Record<string, unknown>
          const propertyTitle = (metadata.propertyTitle as string) || ''
          const propertyId = (metadata.propertyId as string) || ''
          const rejectionReason = metadata.rejectionReason as string | undefined

          return (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 transition-all duration-300 hover:shadow-md hover:scale-[1.02] hover:bg-muted/50 animate-in fade-in slide-in-from-right duration-500 group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="mt-0.5 rounded-full bg-background p-2 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
                <ActivityIcon type={log.activity_type} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {log.description ?? log.activity_type.replace(/_/g, ' ')}
                </p>
                {(propertyTitle || propertyId) && (
                  <p className="text-xs text-muted-foreground">
                    {propertyTitle ? propertyTitle : `Property ID: ${propertyId}`}
                  </p>
                )}
                {rejectionReason && (
                  <p className="text-xs text-red-600">
                    Reason: {rejectionReason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Card className="transition-all duration-300 hover:shadow-md">
      <CardHeader className="group">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary transition-transform group-hover:rotate-12" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>{content()}</CardContent>
    </Card>
  )
}
