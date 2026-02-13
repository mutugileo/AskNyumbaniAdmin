import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export type MarketplaceOfferStatus = 'pending' | 'countered' | 'accepted' | 'declined' | 'withdrawn'

export interface MarketplaceOffer {
  offerId: string
  listingId: string
  domain: 'resale' | 'decor'
  itemType: string
  itemTitle: string
  location: string
  askingPrice: number | null
  currency: string
  offerAmount: number
  status: MarketplaceOfferStatus
  buyerUserId: string | null
  buyerName: string | null
  buyerContact: string | null
  vendorContact: string | null
  vendorName: string | null
  createdAt: string
  updatedAt: string
  imageUrls: string[]
}

export interface MarketplaceOfferMessage {
  id: string
  senderRole: 'buyer' | 'vendor' | 'admin' | 'system'
  message: string | null
  offerAmount: number | null
  createdAt: string
}

function mapOffer(row: Record<string, any>): MarketplaceOffer {
  return {
    offerId: row.offer_id,
    listingId: row.listing_id,
    domain: row.domain,
    itemType: row.item_type,
    itemTitle: row.item_title,
    location: row.location,
    askingPrice: row.asking_price != null ? Number(row.asking_price) : null,
    currency: row.currency ?? 'KES',
    offerAmount: row.offer_amount != null ? Number(row.offer_amount) : 0,
    status: row.status,
    buyerUserId: row.buyer_user_id ?? null,
    buyerName: row.buyer_name ?? null,
    buyerContact: row.buyer_contact ?? null,
    vendorContact: row.vendor_contact ?? null,
    vendorName: row.vendor_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
  }
}

function mapMessage(row: Record<string, any>): MarketplaceOfferMessage {
  return {
    id: row.id,
    senderRole: row.sender_role,
    message: row.message ?? null,
    offerAmount: row.offer_amount != null ? Number(row.offer_amount) : null,
    createdAt: row.created_at,
  }
}

export function useAdminMarketplaceOffers(sessionToken: string, status?: MarketplaceOfferStatus) {
  const normalizedToken = sessionToken.trim()

  return useQuery({
    queryKey: ['admin-marketplace-offers', normalizedToken, status ?? 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_marketplace_offers', {
        p_session_token: normalizedToken,
        p_status: status ?? null,
      })

      if (error) throw error

      const rows = (data as Record<string, any>[] | null) ?? []
      return rows.map(mapOffer)
    },
    enabled: normalizedToken.length > 0,
    refetchInterval: 20000,
  })
}

export function useAdminMarketplaceOfferMessages(sessionToken: string, offerId?: string) {
  const normalizedToken = sessionToken.trim()
  const normalizedOfferId = offerId?.trim() ?? ''

  return useQuery({
    queryKey: ['admin-marketplace-offer-messages', normalizedToken, normalizedOfferId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_marketplace_offer_messages', {
        p_session_token: normalizedToken,
        p_offer_id: normalizedOfferId,
      })

      if (error) throw error

      const rows = (data as Record<string, any>[] | null) ?? []
      return rows.map(mapMessage)
    },
    enabled: normalizedToken.length > 0 && normalizedOfferId.length > 0,
  })
}
