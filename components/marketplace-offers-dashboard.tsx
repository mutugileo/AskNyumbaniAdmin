'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/contexts/auth-context'
import {
  MarketplaceOffer,
  MarketplaceOfferStatus,
  useAdminMarketplaceOfferMessages,
  useAdminMarketplaceOffers,
} from '@/lib/hooks/use-marketplace-offers'
import { Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusColors: Record<MarketplaceOfferStatus, string> = {
  pending: 'border-warning/30 bg-warning/10 text-warning',
  countered: 'border-accent/30 bg-accent/10 text-accent',
  accepted: 'border-success/30 bg-success/10 text-success',
  declined: 'border-destructive/30 bg-destructive/10 text-destructive',
  withdrawn: 'border-muted-foreground/30 bg-muted text-muted-foreground',
}

function formatMoney(amount: number | null, currency: string) {
  if (amount == null) return '\u2014'
  return `${currency} ${amount.toLocaleString()}`
}

function OfferSummary({ offer }: { offer: MarketplaceOffer }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{offer.itemTitle}</p>
          <p className="text-[11px] text-muted-foreground">{offer.itemType} \u00b7 {offer.location}</p>
        </div>
        <Badge variant="outline" className={cn('text-[10px]', statusColors[offer.status])}>
          {offer.status}
        </Badge>
      </div>
      <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
        <div>
          <p className="uppercase tracking-wide text-[10px]">Asking</p>
          <p className="text-xs font-medium text-foreground">{formatMoney(offer.askingPrice, offer.currency)}</p>
        </div>
        <div>
          <p className="uppercase tracking-wide text-[10px]">Offer</p>
          <p className="text-xs font-medium text-foreground">{formatMoney(offer.offerAmount, offer.currency)}</p>
        </div>
        <div>
          <p className="uppercase tracking-wide text-[10px]">Vendor</p>
          <p className="text-xs font-medium text-foreground">{offer.vendorName ?? offer.vendorContact ?? 'Unknown'}</p>
        </div>
      </div>
    </div>
  )
}

export function MarketplaceOffersDashboard() {
  const { sessionToken } = useAuth()
  const offersQuery = useAdminMarketplaceOffers(sessionToken ?? '')
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null)
  const messagesQuery = useAdminMarketplaceOfferMessages(sessionToken ?? '', expandedOfferId ?? undefined)

  const offers = offersQuery.data ?? []
  const stats = useMemo(() => {
    const pending = offers.filter(o => o.status === 'pending').length
    const countered = offers.filter(o => o.status === 'countered').length
    const accepted = offers.filter(o => o.status === 'accepted').length
    const declined = offers.filter(o => o.status === 'declined').length
    return { total: offers.length, pending, countered, accepted, declined }
  }, [offers])

  return (
    <div className="space-y-6">
      {/* Header + stats */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Marketplace Offers</h3>
          <p className="text-xs text-muted-foreground">Track negotiation activity between buyers and vendors.</p>
        </div>
        <div className="stagger-children grid grid-cols-2 gap-3 md:grid-cols-5">
          <MiniStat label="Total" value={stats.total} />
          <MiniStat label="Pending" value={stats.pending} />
          <MiniStat label="Countered" value={stats.countered} />
          <MiniStat label="Accepted" value={stats.accepted} />
          <MiniStat label="Declined" value={stats.declined} />
        </div>
      </div>

      {/* Offer feed */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold">Offer Feed</h3>
          <p className="text-[11px] text-muted-foreground">Read-only oversight for ongoing negotiations.</p>
        </div>

        <div className="p-4 space-y-3">
          {offersQuery.isLoading && (
            <div className="flex items-center gap-2 py-6 justify-center text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading offers...
            </div>
          )}

          {!offersQuery.isLoading && offers.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              No offers yet. Buyer negotiations will show here once the marketplace receives bids.
            </div>
          )}

          {offers.map(offer => {
            const isExpanded = expandedOfferId === offer.offerId
            const messages = isExpanded ? messagesQuery.data ?? [] : []

            return (
              <div key={offer.offerId} className="mod-card mod-card--pending space-y-3">
                <OfferSummary offer={offer} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedOfferId(isExpanded ? null : offer.offerId)}
                  className="gap-1.5 text-xs text-muted-foreground"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {isExpanded ? 'Hide messages' : 'View messages'}
                </Button>

                {isExpanded && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    {messagesQuery.isLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading conversation...
                      </div>
                    )}
                    {!messagesQuery.isLoading && messages.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">No messages yet.</p>
                    )}
                    {!messagesQuery.isLoading && messages.length > 0 && (
                      <div className="space-y-2">
                        {messages.map(message => (
                          <div key={message.id} className="rounded-lg bg-card p-3 text-xs">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              {message.senderRole} \u00b7 {new Date(message.createdAt).toLocaleString()}
                            </p>
                            {message.offerAmount != null && (
                              <p className="text-xs font-semibold mt-0.5">Offer: {formatMoney(message.offerAmount, offer.currency)}</p>
                            )}
                            {message.message && <p className="text-xs mt-0.5">{message.message}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
