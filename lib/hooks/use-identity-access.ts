import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'

export type IdentitySubjectType = 'user' | 'vendor'
export type IdentityStatusFilter = 'all' | 'active' | 'disabled'

export interface IdentityAccessOverviewRow {
  subjectType: IdentitySubjectType
  subjectKey: string
  displayName: string
  contact: string
  roleLabel: string
  isActive: boolean
  statusNote: string | null
  activeSessions: number
  totalSessions: number
  totalTimeSeconds: number
  lastAccessedAt: string | null
  lastSessionStartedAt: string | null
  registeredAt: string | null
}

interface IdentityAccessOverviewRpcRow {
  subject_type: IdentitySubjectType
  subject_key: string
  display_name: string | null
  contact: string | null
  role_label: string | null
  is_active: boolean
  status_note: string | null
  active_sessions: number | null
  total_sessions: number | null
  total_time_seconds: number | null
  last_accessed_at: string | null
  last_session_started_at: string | null
  registered_at: string | null
}

export interface SetIdentityAccessInput {
  subjectType: IdentitySubjectType
  subjectKey: string
  isActive: boolean
  statusNote?: string | null
}

const QUERY_KEY = ['identity-access-overview']

function mapRow(row: IdentityAccessOverviewRpcRow): IdentityAccessOverviewRow {
  return {
    subjectType: row.subject_type,
    subjectKey: row.subject_key,
    displayName: row.display_name?.trim() || (row.subject_type === 'vendor' ? 'Vendor' : 'User'),
    contact: row.contact?.trim() || row.subject_key,
    roleLabel: row.role_label?.trim() || row.subject_type,
    isActive: row.is_active,
    statusNote: row.status_note,
    activeSessions: row.active_sessions ?? 0,
    totalSessions: row.total_sessions ?? 0,
    totalTimeSeconds: row.total_time_seconds ?? 0,
    lastAccessedAt: row.last_accessed_at,
    lastSessionStartedAt: row.last_session_started_at,
    registeredAt: row.registered_at,
  }
}

export function useIdentityAccessOverview(limit = 500) {
  const { sessionToken } = useAuth()

  return useQuery({
    queryKey: [...QUERY_KEY, limit],
    queryFn: async () => {
      if (!sessionToken) {
        throw new Error('Missing admin session token')
      }

      const { data, error } = await supabase.rpc('admin_get_identity_access_overview', {
        p_session_token: sessionToken,
        p_limit: limit,
      })

      if (error) {
        throw error
      }

      return (data as IdentityAccessOverviewRpcRow[] | null ?? []).map(mapRow)
    },
    enabled: Boolean(sessionToken),
    refetchInterval: 45000,
  })
}

export function useSetIdentityAccess() {
  const queryClient = useQueryClient()
  const { sessionToken } = useAuth()

  return useMutation({
    mutationFn: async (input: SetIdentityAccessInput) => {
      if (!sessionToken) {
        throw new Error('Missing admin session token')
      }

      const { error } = await supabase.rpc('admin_set_identity_access', {
        p_session_token: sessionToken,
        p_subject_type: input.subjectType,
        p_subject_key: input.subjectKey,
        p_is_active: input.isActive,
        p_status_note: input.statusNote?.trim() || null,
      })

      if (error) {
        throw error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
