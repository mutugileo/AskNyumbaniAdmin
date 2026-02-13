import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database } from '@/lib/types/database'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/contexts/auth-context'

export type PropertyStatus = Database['public']['Tables']['properties']['Row']['status']

export interface PropertySubmissionRecord {
  id: string
  ownerId: string
  title: string
  description: string
  propertyType: Database['public']['Tables']['properties']['Row']['property_type']
  dealType: Database['public']['Tables']['properties']['Row']['deal_type']
  price: number
  currency: string
  pricePeriod: string | null
  bedrooms: number
  bathrooms: number
  kitchenAreas: number
  squareMeters: number | null
  address: string
  city: string
  region: string
  county: string
  status: PropertyStatus
  isFeatured: boolean
  landDetails: Database['public']['Tables']['properties']['Row']['land_details']
  createdAt: string
  updatedAt: string
  ownerName: string
  ownerEmail: string | null
  ownerPhone: string | null
  imageCount: number
  pendingImageCount: number
  approvedImageCount: number
  rejectedImageCount: number
}

function mapProperty(row: Database['public']['Tables']['properties']['Row']): PropertySubmissionRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    propertyType: row.property_type,
    dealType: row.deal_type,
    price: row.price,
    currency: row.currency,
    pricePeriod: row.price_period,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    kitchenAreas: row.kitchen_areas,
    squareMeters: row.square_meters,
    address: row.address,
    city: row.city,
    region: row.region,
  county: row.county,
  status: row.status,
  isFeatured: row.is_featured ?? false,
  landDetails: row.land_details,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
    ownerName: 'Unknown owner',
    ownerEmail: null,
    ownerPhone: null,
    imageCount: 0,
    pendingImageCount: 0,
    approvedImageCount: 0,
    rejectedImageCount: 0,
  }
}

export function usePropertySubmissions(status?: PropertyStatus | 'all') {
  const { sessionToken } = useAuth()

  return useQuery({
    queryKey: ['admin-property-submissions', sessionToken, status ?? 'all'],
    queryFn: async () => {
      if (!sessionToken) {
        throw new Error('Missing admin session token')
      }

      const normalizedStatus = status && status !== 'all' ? status : null
      const { data, error } = await supabase.rpc('admin_get_property_submissions', {
        p_session_token: sessionToken,
        p_status: normalizedStatus,
        p_limit: 300,
      })

      if (error) throw error

      const rows = (data as Database['public']['Tables']['properties']['Row'][] | null) ?? []
      if (rows.length === 0) return []

      const mapped = rows.map(mapProperty)
      const ownerIds = Array.from(new Set(mapped.map(item => item.ownerId)))
      const propertyIds = mapped.map(item => item.id)

      const [profilesResult, imagesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, phone_number')
          .in('id', ownerIds),
        supabase
          .from('property_images')
          .select('property_id, admin_approved')
          .in('property_id', propertyIds),
      ])

      if (profilesResult.error) throw profilesResult.error
      if (imagesResult.error) throw imagesResult.error

      const profileMap = new Map(
        (profilesResult.data ?? []).map(profile => [profile.id, profile])
      )

      const imageStats = new Map<
        string,
        { total: number; pending: number; approved: number; rejected: number }
      >()

      ;(imagesResult.data ?? []).forEach(image => {
        const current = imageStats.get(image.property_id) ?? {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        }

        current.total += 1
        if (image.admin_approved === true) current.approved += 1
        else if (image.admin_approved === false) current.rejected += 1
        else current.pending += 1

        imageStats.set(image.property_id, current)
      })

      return mapped.map(item => {
        const profile = profileMap.get(item.ownerId)
        const stats = imageStats.get(item.id)

        return {
          ...item,
          ownerName: profile?.full_name ?? item.ownerName,
          ownerEmail: profile?.email ?? null,
          ownerPhone: profile?.phone_number ?? null,
          imageCount: stats?.total ?? 0,
          pendingImageCount: stats?.pending ?? 0,
          approvedImageCount: stats?.approved ?? 0,
          rejectedImageCount: stats?.rejected ?? 0,
        }
      })
    },
    enabled: Boolean(sessionToken),
    refetchInterval: 30000,
  })
}

export function useApprovePropertySubmission() {
  const { sessionToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ propertyId }: { propertyId: string }) => {
      if (!sessionToken) throw new Error('Missing admin session token')

      const { error } = await supabase.rpc('admin_review_property_submission', {
        p_session_token: sessionToken,
        p_property_id: propertyId,
        p_status: 'approved',
        p_rejection_reason: null,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-property-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['pending-image-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['image-review-history'] })
      queryClient.invalidateQueries({ queryKey: ['image-review-stats'] })
      queryClient.invalidateQueries({ queryKey: ['admin-activity-log'] })
    },
  })
}

export function useRejectPropertySubmission() {
  const { sessionToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ propertyId, reason }: { propertyId: string; reason: string }) => {
      if (!sessionToken) throw new Error('Missing admin session token')
      const trimmedReason = reason.trim()
      if (!trimmedReason) throw new Error('Rejection reason is required')

      const { error } = await supabase.rpc('admin_review_property_submission', {
        p_session_token: sessionToken,
        p_property_id: propertyId,
        p_status: 'rejected',
        p_rejection_reason: trimmedReason,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-property-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['pending-image-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['image-review-history'] })
      queryClient.invalidateQueries({ queryKey: ['image-review-stats'] })
      queryClient.invalidateQueries({ queryKey: ['admin-activity-log'] })
    },
  })
}

export function useSetPropertyFeatured() {
  const { sessionToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ propertyId, isFeatured }: { propertyId: string; isFeatured: boolean }) => {
      if (!sessionToken) throw new Error('Missing admin session token')

      const { error } = await supabase.rpc('admin_set_property_featured', {
        p_session_token: sessionToken,
        p_property_id: propertyId,
        p_is_featured: isFeatured,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-property-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['admin-activity-log'] })
    },
  })
}
