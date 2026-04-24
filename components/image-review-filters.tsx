'use client'

import { cn } from '@/lib/utils'
import { Clock, CheckCircle, Grid3X3 } from 'lucide-react'

interface ImageReviewFiltersProps {
  currentFilter: 'pending' | 'approved' | 'all'
  onFilterChange: (filter: 'pending' | 'approved' | 'all') => void
}

export function ImageReviewFilters({ currentFilter, onFilterChange }: ImageReviewFiltersProps) {
  const filters = [
    { key: 'pending' as const, label: 'Pending Review', icon: Clock },
    { key: 'approved' as const, label: 'Approved', icon: CheckCircle },
    { key: 'all' as const, label: 'All Images', icon: Grid3X3 },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const Icon = filter.icon
        const isActive = currentFilter === filter.key

        return (
          <button
            key={filter.key}
            onClick={() => onFilterChange(filter.key)}
            className={cn(
              'tab-btn',
              isActive ? 'tab-btn--active' : 'tab-btn--inactive'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {filter.label}
          </button>
        )
      })}
    </div>
  )
}
