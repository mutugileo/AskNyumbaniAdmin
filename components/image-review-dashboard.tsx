'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ImageReviewGrid } from '@/components/image-review-grid'
import { ImageReviewFilters } from '@/components/image-review-filters'
import { AdminActivityLog } from '@/components/admin-activity-log'
import { useImageReviewStats } from '@/lib/hooks/use-image-reviews'
import { CheckCircle, XCircle, Clock, Image as ImageIcon } from 'lucide-react'

export function ImageReviewDashboard() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending')
  const { data: stats, isLoading: statsLoading } = useImageReviewStats()

  return (
    <div className="min-h-screen bg-background">

      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-yellow-500 transition-all duration-300 hover:shadow-md hover:scale-[1.02] animate-in fade-in slide-in-from-left duration-500 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-yellow-600">
                Pending Review
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-500 transition-transform group-hover:rotate-12 group-hover:scale-110" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 transition-all duration-300 group-hover:scale-110">
                {statsLoading ? '...' : stats?.pending || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Images awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 transition-all duration-300 hover:shadow-md hover:scale-[1.02] animate-in fade-in slide-in-from-bottom duration-500 delay-150 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-green-600">
                Approved
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500 transition-transform group-hover:rotate-12 group-hover:scale-110" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 transition-all duration-300 group-hover:scale-110">
                {statsLoading ? '...' : stats?.approved || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Live in mobile app
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary transition-all duration-300 hover:shadow-md hover:scale-[1.02] animate-in fade-in slide-in-from-right duration-500 delay-300 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
                Total Images
              </CardTitle>
              <ImageIcon className="h-4 w-4 text-primary transition-transform group-hover:rotate-12 group-hover:scale-110" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary transition-all duration-300 group-hover:scale-110">
                {statsLoading ? '...' : stats?.total || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                All property images
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="animate-in fade-in slide-in-from-top duration-500 delay-500">
          <ImageReviewFilters
            currentFilter={filter}
            onFilterChange={setFilter}
          />
        </div>

        {/* Image Review Grid + Activity */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[3fr,1fr] animate-in fade-in slide-in-from-bottom duration-700 delay-700">
          <div className="space-y-6">
            <ImageReviewGrid filter={filter} />
          </div>
          <div className="xl:sticky xl:top-6 xl:self-start">
            <AdminActivityLog />
          </div>
        </div>
      </div>
    </div>
  )
}
