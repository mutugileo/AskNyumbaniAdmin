'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useIdentityAccessOverview, useSetIdentityAccess } from '@/lib/hooks/use-identity-access'
import { Loader2, RefreshCcw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

type SubjectFilter = 'all' | 'user' | 'vendor'
type StatusFilter = 'all' | 'active' | 'disabled'

function formatDate(value: string | null): string {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours <= 0) return `${Math.max(minutes, 1)}m`
  if (minutes <= 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export function AccessControlDashboard() {
  const query = useIdentityAccessOverview(750)
  const setAccessMutation = useSetIdentityAccess()
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pendingIdentityKey, setPendingIdentityKey] = useState<string | null>(null)

  const rows = query.data ?? []
  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return rows.filter((row) => {
      if (subjectFilter !== 'all' && row.subjectType !== subjectFilter) return false
      if (statusFilter === 'active' && !row.isActive) return false
      if (statusFilter === 'disabled' && row.isActive) return false
      if (!normalizedSearch) return true

      return (
        row.displayName.toLowerCase().includes(normalizedSearch) ||
        row.contact.toLowerCase().includes(normalizedSearch) ||
        row.subjectKey.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [rows, search, subjectFilter, statusFilter])

  const summary = useMemo(() => {
    const users = rows.filter((row) => row.subjectType === 'user').length
    const vendors = rows.filter((row) => row.subjectType === 'vendor').length
    const disabled = rows.filter((row) => !row.isActive).length
    const activeSessions = rows.reduce((sum, row) => sum + row.activeSessions, 0)
    return { total: rows.length, users, vendors, disabled, activeSessions }
  }, [rows])

  const onSetAccess = async (
    subjectType: 'user' | 'vendor',
    subjectKey: string,
    isActive: boolean,
    currentLabel: string
  ) => {
    const identityKey = `${subjectType}:${subjectKey}`
    setPendingIdentityKey(identityKey)

    try {
      await setAccessMutation.mutateAsync({
        subjectType,
        subjectKey,
        isActive,
        statusNote: isActive ? 'Re-activated by admin' : 'Disabled by admin',
      })
      toast.success(`${currentLabel} ${isActive ? 'activated' : 'disabled'}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update access status')
    } finally {
      setPendingIdentityKey(null)
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/75 bg-background/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Identity Access Overview</CardTitle>
          <CardDescription>
            Monitor all registered users and vendors, active sessions, and account access states.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryStat label="Total identities" value={summary.total.toString()} />
          <SummaryStat label="Users" value={summary.users.toString()} />
          <SummaryStat label="Vendors" value={summary.vendors.toString()} />
          <SummaryStat label="Disabled" value={summary.disabled.toString()} />
          <SummaryStat label="Active sessions" value={summary.activeSessions.toString()} />
        </CardContent>
      </Card>

      <Card className="border-border/75 bg-background/85">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg">Users & Vendors</CardTitle>
              <CardDescription>Activate or disable account access and inspect session visibility.</CardDescription>
            </div>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => query.refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, contact, or key..."
              className="h-10 rounded-lg"
            />

            <select
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value as SubjectFilter)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="all">All types</option>
              <option value="user">Users</option>
              <option value="vendor">Vendors</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {query.isLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading identities...
            </div>
          )}

          {query.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(query.error as Error).message}
            </div>
          )}

          {!query.isLoading && filteredRows.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/70 bg-background/60 p-6 text-center text-sm text-muted-foreground">
              No matching identities found for the current filters.
            </div>
          )}

          {filteredRows.map((row) => {
            const identityKey = `${row.subjectType}:${row.subjectKey}`
            const isPending = setAccessMutation.isPending && pendingIdentityKey === identityKey
            const liveSession = row.activeSessions > 0
            const isVendor = row.subjectType === 'vendor'

            return (
              <article key={identityKey} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold">{row.displayName}</p>
                      <Badge variant="outline" className="rounded-md capitalize">
                        {row.subjectType}
                      </Badge>
                      <Badge
                        className={row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                        variant="secondary"
                      >
                        {row.isActive ? 'active' : 'disabled'}
                      </Badge>
                      <Badge variant="secondary" className="rounded-md">
                        {liveSession ? 'live session' : row.totalSessions > 0 ? 'idle' : 'no sessions'}
                      </Badge>
                    </div>

                    <div className="grid gap-1 text-sm text-muted-foreground">
                      <p className="truncate">{row.contact}</p>
                      <p className="truncate capitalize">{row.roleLabel}</p>
                      {row.statusNote ? <p className="truncate">Note: {row.statusNote}</p> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isPending || row.isActive}
                      onClick={() => onSetAccess(row.subjectType, row.subjectKey, true, row.displayName)}
                      className="rounded-lg"
                    >
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                      Activate
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isPending || !row.isActive}
                      onClick={() => onSetAccess(row.subjectType, row.subjectKey, false, row.displayName)}
                      className="rounded-lg"
                    >
                      {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                      Disable
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-2 xl:grid-cols-6">
                  <Metric label="Active sessions" value={row.activeSessions.toString()} />
                  <Metric label="Total sessions" value={row.totalSessions.toString()} />
                  <Metric label="Logged time" value={formatDuration(row.totalTimeSeconds)} />
                  <Metric label="Last accessed" value={formatDate(row.lastAccessedAt)} />
                  <Metric label="Session started" value={formatDate(row.lastSessionStartedAt)} />
                  <Metric label="Registered" value={formatDate(row.registeredAt)} />
                </div>

                {!isVendor && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Session telemetry is currently tracked for vendors. User session metrics may show as zero.
                  </p>
                )}
              </article>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/90 px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}
