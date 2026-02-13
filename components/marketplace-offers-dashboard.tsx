'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/contexts/auth-context'
import {
  MarketplaceOffer,
  MarketplaceOfferStatus,
  useAdminMarketplaceOfferMessages,
  useAdminMarketplaceOffers,
} from '@/lib/hooks/use-marketplace-offers'
import { Loader2, MessageSquare } from 'lucide-react'

const statusBadge: Record<MarketplaceOfferStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  countered: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
  withdrawn: 'bg-slate-100 text-slate-700',
}

function formatMoney(amount: number | null, currency: string) {
  if (amount == null) return '—'
  return `${currency} ${amount.toLocaleString()}`
}

function OfferSummary({ offer }: { offer: MarketplaceOffer }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{offer.itemTitle}</p>
          <p className="text-xs text-muted-foreground">
            {offer.itemType} • {offer.location}
          </p>
        </div>
        <Badge className={statusBadge[offer.status]} variant="secondary">
          {offer.status}
        </Badge>
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <div>
          <p className="uppercase tracking-wide">Asking</p>
          <p className="text-sm font-medium text-foreground">{formatMoney(offer.askingPrice, offer.currency)}</p>
        </div>
        <div>
          <p className="uppercase tracking-wide">Offer</p>
          <p className="text-sm font-medium text-foreground">{formatMoney(offer.offerAmount, offer.currency)}</p>
        </div>
        <div>
          <p className="uppercase tracking-wide">Vendor</p>
          <p className="text-sm font-medium text-foreground">{offer.vendorName ?? offer.vendorContact ?? 'Unknown'}</p>
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
    const pending = offers.filter(offer => offer.status === 'pending').length
    const countered = offers.filter(offer => offer.status === 'countered').length
    const accepted = offers.filter(offer => offer.status === 'accepted').length
    const declined = offers.filter(offer => offer.status === 'declined').length
    return { total: offers.length, pending, countered, accepted, declined }
  }, [offers])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Marketplace Offers</CardTitle>
          <CardDescription>
            Track negotiation activity between buyers and vendors across resale and decor listings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Total" value={stats.total} />
            <Stat label="Pending" value={stats.pending} />
            <Stat label="Countered" value={stats.countered} />
            <Stat label="Accepted" value={stats.accepted} />
            <Stat label="Declined" value={stats.declined} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Offer Feed</CardTitle>
          <CardDescription>Read-only oversight for ongoing negotiations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {offersQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading offers...
            </div>
          )}

          {!offersQuery.isLoading && offers.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No offers yet. Buyer negotiations will show here once the marketplace receives bids.
            </div>
          )}

          {offers.map(offer => {
            const isExpanded = expandedOfferId === offer.offerId
            const messages = isExpanded ? messagesQuery.data ?? [] : []

            return (
              <Card key={offer.offerId} className="border-l-4 border-l-primary/30">
                <CardContent className="space-y-4 pt-5">
                  <OfferSummary offer={offer} />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setExpandedOfferId(isExpanded ? null : offer.offerId)}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {isExpanded ? 'Hide messages' : 'View messages'}
                  </Button>

                  {isExpanded && (
                    <div className="rounded-lg border bg-muted/30 p-4">
                      {messagesQuery.isLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading conversation...
                        </div>
                      )}
                      {!messagesQuery.isLoading && messages.length === 0 && (
                        <p className="text-sm text-muted-foreground">No messages yet.</p>
                      )}
                      {!messagesQuery.isLoading && messages.length > 0 && (
                        <div className="space-y-3">
                          {messages.map(message => (
                            <div key={message.id} className="rounded-md bg-background p-3 text-sm">
                              <p className="text-xs text-muted-foreground">
                                {message.senderRole.toUpperCase()} • {new Date(message.createdAt).toLocaleString()}
                              </p>
                              {message.offerAmount != null && (
                                <p className="text-sm font-semibold text-foreground">
                                  Offer: {formatMoney(message.offerAmount, offer.currency)}
                                </p>
                              )}
                              {message.message && <p className="text-sm text-foreground">{message.message}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}
