'use client'

import { MarketplaceControlPanel } from '@/components/marketplace-control-panel'
import { decorItemTypes } from '@/lib/hooks/use-marketplace-moderation'

export function DecorControlDashboard() {
  return (
    <MarketplaceControlPanel
      domain="decor"
      title="Decor Control Menu"
      description="Review decor vendor submissions and publish only approved items."
      itemTypeOptions={decorItemTypes}
    />
  )
}
