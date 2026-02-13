'use client'

import { MarketplaceControlPanel } from '@/components/marketplace-control-panel'
import { MarketplaceSubmission, resaleItemTypes } from '@/lib/hooks/use-marketplace-moderation'

function isConstructSubmission(item: MarketplaceSubmission): boolean {
  const payload = item.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const moduleValue = String((payload as Record<string, unknown>).module ?? '').toLowerCase()
  return moduleValue === 'construct' || moduleValue === 'construction'
}

export function ResaleControlDashboard() {
  return (
    <MarketplaceControlPanel
      domain="resale"
      title="Resale Control Menu"
      description="Review vendor/user resale submissions before they go live in the app."
      itemTypeOptions={resaleItemTypes}
      filterSubmission={(item) => !isConstructSubmission(item)}
    />
  )
}
