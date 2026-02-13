import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'
import { Json, MarketplaceItemSubmission } from '@/lib/types/database'

export type MarketplaceDomain = MarketplaceItemSubmission['domain']
export type MarketplaceStatus = MarketplaceItemSubmission['status']

export interface MarketplaceSubmission {
  id: string
  domain: MarketplaceDomain
  itemType: string
  title: string
  submittedBy: string
  submitterContact: string
  submittedByUserId: string | null
  source: MarketplaceItemSubmission['source']
  location: string
  price: number | null
  currency: string
  description: string
  imageUrls: string[]
  payload: MarketplaceItemSubmission['payload']
  status: MarketplaceStatus
  rejectionReason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  published: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateMarketplaceSubmissionInput {
  domain: MarketplaceDomain
  itemType: string
  title: string
  submittedBy: string
  submitterContact: string
  location: string
  price?: number | null
  currency?: string
  description?: string
  imageUrls?: string[]
  payload?: Json
  submittedByUserId?: string | null
  source?: 'vendor' | 'admin'
}

export interface VendorCreateMarketplaceSubmissionInput {
  sessionToken: string
  domain: MarketplaceDomain
  itemType: string
  title: string
  submittedBy: string
  location: string
  price?: number | null
  currency?: string
  description?: string
  imageUrls?: string[]
  payload?: Json
}

export interface VendorResubmitMarketplaceSubmissionInput {
  sessionToken: string
  submissionId: string
  itemType: string
  title: string
  location: string
  price?: number | null
  currency?: string
  description?: string
  imageUrls?: string[]
  payload?: Json
}

export const resaleItemTypes = [
  'Furniture',
  'Appliance',
  'Electronics',
  'Kitchenware',
  'Garden',
  'Other',
]

export const decorItemTypes = [
  'Ceiling Service',
  'Wall Finish',
  'Flooring',
  'Lighting',
  'Kitchen Fitout',
  'Wardrobe',
  'Other',
]

export const constructItemTypes = [
  'Cement',
  'Sand',
  'Ballast',
  'Blocks',
  'Bricks',
  'Steel/Rebar',
  'Roofing Sheets',
  'Tiles',
  'Paint',
  'Plumbing',
  'Electrical',
  'Timber',
  'Other',
]

function mapRow(row: MarketplaceItemSubmission): MarketplaceSubmission {
  const imageUrls = Array.isArray(row.image_urls) ? row.image_urls.filter(item => typeof item === 'string') as string[] : []

  return {
    id: row.id,
    domain: row.domain,
    itemType: row.item_type,
    title: row.title,
    submittedBy: row.submitted_by_name,
    submitterContact: row.submitted_by_contact,
    submittedByUserId: row.submitted_by_user_id,
    source: row.source,
    location: row.location,
    price: row.price,
    currency: row.currency,
    description: row.description ?? '',
    imageUrls,
    payload: row.payload,
    status: row.status,
    rejectionReason: row.rejection_reason,
    reviewedBy: row.reviewed_by_name,
    reviewedAt: row.reviewed_at,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function isMarketplaceSchemaMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string }
  const normalized = `${maybeError.message ?? ''} ${maybeError.details ?? ''} ${maybeError.hint ?? ''}`.toLowerCase()

  if (maybeError.code === '42P01' || maybeError.code === '42703' || maybeError.code === '42883') return true

  return (
    normalized.includes('marketplace_item_submissions') ||
    normalized.includes('admin_get_marketplace_item_submissions') ||
    normalized.includes('submit_marketplace_item_submission')
  )
}

export function useMarketplaceSubmissions(domain: MarketplaceDomain) {
  const { sessionToken } = useAuth()

  return useQuery({
    queryKey: ['marketplace-submissions', domain],
    queryFn: async () => {
      if (!sessionToken) {
        throw new Error('Missing admin session token')
      }

      const { data, error } = await supabase.rpc('admin_get_marketplace_item_submissions', {
        p_session_token: sessionToken,
        p_domain: domain,
        p_status: null,
      })

      if (error) throw error

      return (data as MarketplaceItemSubmission[] | null ?? []).map(mapRow)
    },
    enabled: Boolean(sessionToken),
    refetchInterval: 30000,
  })
}

export function useVendorMarketplaceSubmissions(
  sessionToken: string,
  domain?: MarketplaceDomain
) {
  const normalizedToken = sessionToken.trim()

  return useQuery({
    queryKey: ['vendor-marketplace-submissions', normalizedToken, domain ?? 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vendor_get_marketplace_item_submissions', {
        p_session_token: normalizedToken,
        p_domain: domain ?? null,
        p_limit: 300,
      })

      if (error) throw error

      return (data as MarketplaceItemSubmission[] | null ?? []).map(mapRow)
    },
    enabled: normalizedToken.length > 0,
    refetchInterval: 30000,
  })
}

export function useCreateMarketplaceSubmission() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payload: CreateMarketplaceSubmissionInput) => {
      const { data, error } = await supabase.rpc('submit_marketplace_item_submission', {
        p_domain: payload.domain,
        p_item_type: payload.itemType,
        p_title: payload.title,
        p_submitted_by_name: payload.submittedBy,
        p_submitted_by_contact: payload.submitterContact,
        p_location: payload.location,
        p_price: payload.price ?? null,
        p_currency: payload.currency ?? 'KES',
        p_description: payload.description?.trim() ? payload.description.trim() : null,
        p_image_urls: payload.imageUrls ?? [],
        p_payload: payload.payload ?? {},
        p_submitted_by_user_id: payload.submittedByUserId ?? null,
        p_source: payload.source ?? 'vendor',
      })

      if (error) throw error

      if (user) {
        await supabase.from('admin_activity_log').insert([
          {
            admin_user_id: user.id,
            activity_type: 'marketplace_submission_created',
            description: `Created ${payload.domain} submission "${payload.title}"`,
            metadata: {
              domain: payload.domain,
              itemType: payload.itemType,
              source: payload.source ?? 'vendor',
            },
          },
        ])
      }

      return data as string | undefined
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-submissions', variables.domain] })
    },
  })
}

export function useVendorResubmitMarketplaceSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: VendorResubmitMarketplaceSubmissionInput) => {
      const { error } = await supabase.rpc('vendor_resubmit_marketplace_item_submission', {
        p_submission_id: payload.submissionId,
        p_session_token: payload.sessionToken,
        p_item_type: payload.itemType,
        p_title: payload.title,
        p_location: payload.location,
        p_price: payload.price ?? null,
        p_currency: payload.currency ?? 'KES',
        p_description: payload.description?.trim() ? payload.description.trim() : null,
        p_image_urls: payload.imageUrls ?? [],
        p_payload: payload.payload ?? {},
      })

      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-marketplace-submissions', variables.sessionToken.trim()] })
      queryClient.invalidateQueries({ queryKey: ['marketplace-submissions'] })
    },
  })
}

export function useVendorCreateMarketplaceSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: VendorCreateMarketplaceSubmissionInput) => {
      const { data, error } = await supabase.rpc('vendor_submit_marketplace_item_submission', {
        p_session_token: payload.sessionToken,
        p_item_type: payload.itemType,
        p_title: payload.title,
        p_submitted_by_name: payload.submittedBy,
        p_location: payload.location,
        p_price: payload.price ?? null,
        p_currency: payload.currency ?? 'KES',
        p_description: payload.description?.trim() ? payload.description.trim() : null,
        p_image_urls: payload.imageUrls ?? [],
        p_payload: payload.payload ?? {},
        p_domain: payload.domain,
      })

      if (error) throw error
      return data as string | undefined
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-marketplace-submissions', variables.sessionToken.trim()] })
    },
  })
}

export function useApproveMarketplaceSubmission() {
  const queryClient = useQueryClient()
  const { sessionToken, user } = useAuth()

  return useMutation({
    mutationFn: async ({ submissionId }: { submissionId: string }) => {
      if (!sessionToken) {
        throw new Error('Missing admin session token')
      }

      const { error } = await supabase.rpc('admin_review_marketplace_item_submission', {
        p_session_token: sessionToken,
        p_submission_id: submissionId,
        p_status: 'approved',
        p_rejection_reason: null,
      })

      if (error) throw error

      if (user) {
        await supabase.from('admin_activity_log').insert([
          {
            admin_user_id: user.id,
            activity_type: 'marketplace_submission_approved',
            description: 'Approved marketplace submission',
            metadata: {
              submissionId,
              action: 'approve',
            },
          },
        ])
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-submissions'] })
    },
  })
}

export function useRejectMarketplaceSubmission() {
  const queryClient = useQueryClient()
  const { sessionToken, user } = useAuth()

  return useMutation({
    mutationFn: async ({ submissionId, rejectionReason }: { submissionId: string; rejectionReason: string }) => {
      if (!sessionToken) {
        throw new Error('Missing admin session token')
      }

      const reason = rejectionReason.trim()
      if (!reason) {
        throw new Error('Rejection reason is required')
      }

      const { error } = await supabase.rpc('admin_review_marketplace_item_submission', {
        p_session_token: sessionToken,
        p_submission_id: submissionId,
        p_status: 'rejected',
        p_rejection_reason: reason,
      })

      if (error) throw error

      if (user) {
        await supabase.from('admin_activity_log').insert([
          {
            admin_user_id: user.id,
            activity_type: 'marketplace_submission_rejected',
            description: 'Rejected marketplace submission',
            metadata: {
              submissionId,
              rejectionReason: reason,
              action: 'reject',
            },
          },
        ])
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-submissions'] })
    },
  })
}
