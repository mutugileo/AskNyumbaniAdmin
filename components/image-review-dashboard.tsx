'use client'

import { useState } from 'react'
import { ImageReviewGrid } from '@/components/image-review-grid'
import { ImageReviewFilters } from '@/components/image-review-filters'
import { AdminActivityLog } from '@/components/admin-activity-log'
import { useImageReviewStats } from '@/lib/hooks/use-image-reviews'
import { CheckCircle, Clock, Image as ImageIcon } from 'lucide-react'

export function ImageReviewDashboard() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending')
  const { data: stats, isLoading: statsLoading } = useImageReviewStats()

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="stagger-children grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="stat-card rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pending Review</p>
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-warning">
            {statsLoading ? '\u2014' : stats?.pending || 0}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Images awaiting approval</p>
        </div>

        <div className="stat-card rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Approved</p>
            <CheckCircle className="h-4 w-4 text-success" />
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-success">
            {statsLoading ? '\u2014' : stats?.approved || 0}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Live in mobile app</p>
        </div>

        <div className="stat-card rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Images</p>
            <ImageIcon className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight text-primary">
            {statsLoading ? '\u2014' : stats?.total || 0}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">All property images</p>
        </div>
      </div>

      {/* Filters */}
      <ImageReviewFilters currentFilter={filter} onFilterChange={setFilter} />

      {/* Grid + Activity */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr_1fr]">
        <ImageReviewGrid filter={filter} />
        <div className="xl:sticky xl:top-22 xl:self-start">
          <AdminActivityLog />
        </div>
      </div>
    </div>
  )
}
