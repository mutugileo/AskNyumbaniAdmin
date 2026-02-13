'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, CheckCircle, XCircle, Grid3X3 } from 'lucide-react'

interface ImageReviewFiltersProps {
  currentFilter: 'pending' | 'approved' | 'all'
  onFilterChange: (filter: 'pending' | 'approved' | 'all') => void
}

export function ImageReviewFilters({ currentFilter, onFilterChange }: ImageReviewFiltersProps) {
  const filters = [
    {
      key: 'pending' as const,
      label: 'Pending Review',
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 hover:bg-yellow-100',
      activeBgColor: 'bg-yellow-100',
    },
    {
      key: 'approved' as const,
      label: 'Approved',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      activeBgColor: 'bg-green-100',
    },
    {
      key: 'all' as const,
      label: 'All Images',
      icon: Grid3X3,
      color: 'text-primary',
      bgColor: 'bg-primary/10 hover:bg-primary/20',
      activeBgColor: 'bg-primary/20',
    },
  ]

  return (
    <Card className="transition-all duration-300 hover:shadow-md">
      <CardContent className="p-6">
        <div className="flex flex-wrap gap-3">
          {filters.map((filter) => {
            const Icon = filter.icon
            const isActive = currentFilter === filter.key

            return (
              <Button
                key={filter.key}
                variant="ghost"
                onClick={() => onFilterChange(filter.key)}
                className={`
                  ${isActive ? filter.activeBgColor : filter.bgColor}
                  ${filter.color}
                  border-0
                  transition-all
                  duration-200
                  font-medium
                  hover:scale-105
                  hover:shadow-md
                  ${isActive ? 'ring-2 ring-offset-2 ring-current ring-opacity-50' : ''}
                  group
                `}
              >
                <Icon className="h-4 w-4 mr-2 transition-transform group-hover:rotate-12 group-hover:scale-110" />
                {filter.label}
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
