import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'
import { Json, RelocationCatalogSubmission } from '@/lib/types/database'

export type RelocationSubmissionType = RelocationCatalogSubmission['submission_type']
export type RelocationSubmissionStatus = RelocationCatalogSubmission['status']

export interface RelocationSubmission {
  id: string
  type: RelocationSubmissionType
  title: string
  submittedBy: string
  submitterContact: string
  submittedByUserId: string | null
  source: RelocationCatalogSubmission['source']
  location: string
  payloadSummary: string
  payload: Json
  notes: string
  status: RelocationSubmissionStatus
  rejectionReason: string | null
  reviewedByUserId: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  published: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateRelocationSubmissionInput {
  type: RelocationSubmissionType
  title: string
  submittedBy: string
  submitterContact: string
  location: string
  payloadSummary: string
  notes?: string
  payload?: Json
  source?: RelocationCatalogSubmission['source']
  submittedByUserId?: string | null
}

export interface VendorCreateRelocationSubmissionInput {
  sessionToken: string
  type: RelocationSubmissionType
  title: string
  submittedBy: string
  location: string
  payloadSummary: string
  notes?: string
  payload?: Json
}

export interface UpdateRelocationSubmissionStatusInput {
  submissionId: string
  rejectionReason?: string
}

export interface VendorResubmitRelocationSubmissionInput {
  sessionToken: string
  submissionId: string
  type: RelocationSubmissionType
  title: string
  location: string
  payloadSummary: string
  notes?: string
  payload?: Json
}

type ActivityMetadata = Record<string, unknown>

export const relocationSubmissionTypeLabels: Record<RelocationSubmissionType, string> = {
  mover_profile: 'Mover Profile',
  vehicle: 'Vehicle',
  service_type: 'Service Type',
  inventory_template: 'Inventory Template',
  addon: 'Add-on',
  coverage_zone: 'Coverage Zone',
  pricing_rule: 'Pricing Rule',
}

function mapRowToSubmission(row: RelocationCatalogSubmission): RelocationSubmission {
  return {
    id: row.id,
    type: row.submission_type,
    title: row.title,
    submittedBy: row.submitted_by_name,
    submitterContact: row.submitted_by_contact,
    submittedByUserId: row.submitted_by_user_id,
    source: row.source,
    location: row.location,
    payloadSummary: row.payload_summary,
    payload: row.payload,
    notes: row.notes ?? '',
    status: row.status,
    rejectionReason: row.rejection_reason,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedBy: row.reviewed_by_name,
    reviewedAt: row.reviewed_at,
    published: row.published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toSubmissionStatusActivityType(status: RelocationSubmissionStatus): string {
  if (status === 'approved') return 'relocation_submission_approved'
  if (status === 'rejected') return 'relocation_submission_rejected'
  return 'relocation_submission_pending'
}

async function logAdminActivity(params: {
  adminUserId: string
  activityType: string
  description: string
  metadata?: ActivityMetadata
}) {
  const { adminUserId, activityType, description, metadata } = params

  try {
    const { error } = await supabase.from('admin_activity_log').insert([
      {
        admin_user_id: adminUserId,
        activity_type: activityType,
        description,
        metadata: metadata ?? null,
      },
    ])

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Failed to log admin activity:', error)
  }
}

export function isRelocationSchemaMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const maybeError = error as { code?: string; message?: string; details?: string; hint?: string }
  const normalized = `${maybeError.message ?? ''} ${maybeError.details ?? ''} ${maybeError.hint ?? ''}`.toLowerCase()

  if (maybeError.code === '42P01' || maybeError.code === '42703' || maybeError.code === '42883') return true

  return (
    normalized.includes('relocation_catalog_submissions') &&
    (normalized.includes('does not exist') || normalized.includes('undefined'))
  )
}

export function useRelocationSubmissions() {
  const { sessionToken } = useAuth()

  return useQuery({
    queryKey: ['relocation-submissions'],
    queryFn: async () => {
      if (!sessionToken) {
        throw new Error('Missing admin session token')
      }

      const { data, error } = await supabase.rpc('admin_get_relocation_submissions', {
        p_session_token: sessionToken,
      })

      if (error) throw error

      return (data as RelocationCatalogSubmission[] | null ?? []).map(mapRowToSubmission)
    },
    enabled: Boolean(sessionToken),
    refetchInterval: 30000,
  })
}

export function useVendorRelocationSubmissions(sessionToken: string) {
  const normalizedToken = sessionToken.trim()

  return useQuery({
    queryKey: ['vendor-relocation-submissions', normalizedToken],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('vendor_get_relocation_submissions', {
        p_session_token: normalizedToken,
        p_limit: 300,
      })

      if (error) throw error

      return (data as RelocationCatalogSubmission[] | null ?? []).map(mapRowToSubmission)
    },
    enabled: normalizedToken.length > 0,
    refetchInterval: 30000,
  })
}

export function useCreateRelocationSubmission() {
  const queryClient = useQueryClient()
  const { user, sessionToken } = useAuth()

  return useMutation({
    mutationFn: async (payload: CreateRelocationSubmissionInput) => {
      const { data, error } = await supabase.rpc('submit_relocation_catalog_submission', {
        p_submission_type: payload.type,
        p_title: payload.title,
        p_submitted_by_name: payload.submittedBy,
        p_submitted_by_contact: payload.submitterContact,
        p_location: payload.location,
        p_payload_summary: payload.payloadSummary,
        p_notes: payload.notes?.trim() ? payload.notes.trim() : null,
        p_payload: payload.payload ?? {},
        p_source: payload.source ?? 'admin',
        p_submitted_by_user_id: payload.submittedByUserId ?? null,
        p_admin_session_token: sessionToken,
      })

      if (error) throw error

      if (user) {
        await logAdminActivity({
          adminUserId: user.id,
          activityType: 'relocation_submission_created',
          description: `Created relocation submission "${payload.title}"`,
          metadata: {
            submissionType: payload.type,
            location: payload.location,
            submittedBy: payload.submittedBy,
          },
        })
      }

      return data as string | undefined
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relocation-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['admin-activity-log'] })
    },
  })
}

export function useApproveRelocationSubmission() {
  const queryClient = useQueryClient()
  const { user, sessionToken } = useAuth()

  return useMutation({
    mutationFn: async ({ submissionId }: UpdateRelocationSubmissionStatusInput) => {
      if (!sessionToken) {
        throw new Error('Missing admin session token')
      }

      const { error } = await supabase.rpc('admin_review_relocation_submission', {
        p_session_token: sessionToken,
        p_submission_id: submissionId,
        p_status: 'approved',
        p_rejection_reason: null,
      })

      if (error) throw error

      if (user) {
        await logAdminActivity({
          adminUserId: user.id,
          activityType: toSubmissionStatusActivityType('approved'),
          description: 'Approved relocation submission',
          metadata: {
            submissionId,
            action: 'approve',
          },
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relocation-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['admin-activity-log'] })
    },
  })
}

export function useRejectRelocationSubmission() {
  const queryClient = useQueryClient()
  const { user, sessionToken } = useAuth()

  return useMutation({
    mutationFn: async ({ submissionId, rejectionReason }: UpdateRelocationSubmissionStatusInput) => {
      const reason = rejectionReason?.trim()
      if (!reason) {
        throw new Error('Rejection reason is required')
      }

      if (!sessionToken) {
        throw new Error('Missing admin session token')
      }

      const { error } = await supabase.rpc('admin_review_relocation_submission', {
        p_session_token: sessionToken,
        p_submission_id: submissionId,
        p_status: 'rejected',
        p_rejection_reason: reason,
      })

      if (error) throw error

      if (user) {
        await logAdminActivity({
          adminUserId: user.id,
          activityType: toSubmissionStatusActivityType('rejected'),
          description: 'Rejected relocation submission',
          metadata: {
            submissionId,
            rejectionReason: reason,
            action: 'reject',
          },
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relocation-submissions'] })
      queryClient.invalidateQueries({ queryKey: ['admin-activity-log'] })
    },
  })
}

export function useVendorResubmitRelocationSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: VendorResubmitRelocationSubmissionInput) => {
      const { error } = await supabase.rpc('vendor_resubmit_relocation_submission', {
        p_submission_id: payload.submissionId,
        p_session_token: payload.sessionToken,
        p_submission_type: payload.type,
        p_title: payload.title,
        p_location: payload.location,
        p_payload_summary: payload.payloadSummary,
        p_notes: payload.notes?.trim() ? payload.notes.trim() : null,
        p_payload: payload.payload ?? {},
      })

      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-relocation-submissions', variables.sessionToken.trim()] })
      queryClient.invalidateQueries({ queryKey: ['relocation-submissions'] })
    },
  })
}

export function useVendorCreateRelocationSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: VendorCreateRelocationSubmissionInput) => {
      const { data, error } = await supabase.rpc('vendor_submit_relocation_catalog_submission', {
        p_session_token: payload.sessionToken,
        p_submission_type: payload.type,
        p_title: payload.title,
        p_submitted_by_name: payload.submittedBy,
        p_location: payload.location,
        p_payload_summary: payload.payloadSummary,
        p_notes: payload.notes?.trim() ? payload.notes.trim() : null,
        p_payload: payload.payload ?? {},
      })

      if (error) throw error
      return data as string | undefined
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-relocation-submissions', variables.sessionToken.trim()] })
    },
  })
}
