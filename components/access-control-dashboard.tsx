'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useIdentityAccessOverview, useSetIdentityAccess } from '@/lib/hooks/use-identity-access'
import { Loader2, RefreshCcw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
    const users = rows.filter((r) => r.subjectType === 'user').length
    const vendors = rows.filter((r) => r.subjectType === 'vendor').length
    const disabled = rows.filter((r) => !r.isActive).length
    const activeSessions = rows.reduce((sum, r) => sum + r.activeSessions, 0)
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
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="stagger-children grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MiniStat label="Total identities" value={summary.total.toString()} />
        <MiniStat label="Users" value={summary.users.toString()} />
        <MiniStat label="Vendors" value={summary.vendors.toString()} />
        <MiniStat label="Disabled" value={summary.disabled.toString()} />
        <MiniStat label="Active sessions" value={summary.activeSessions.toString()} />
      </div>

      {/* Filter + list */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Users & Vendors</h3>
            <p className="text-xs text-muted-foreground">Activate or disable account access and inspect sessions.</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => query.refetch()}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Filters */}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px]">
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, contact, or key..." className="h-9 text-sm" />
            <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value as SubjectFilter)}
              className="h-9 rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="all">All types</option>
              <option value="user">Users</option>
              <option value="vendor">Vendors</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {query.isLoading && (
            <div className="flex items-center gap-2 py-6 justify-center text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading identities...
            </div>
          )}

          {query.error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {(query.error as Error).message}
            </div>
          )}

          {!query.isLoading && filteredRows.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              No matching identities found.
            </div>
          )}

          {/* Identity rows */}
          <div className="space-y-3">
            {filteredRows.map((row) => {
              const identityKey = `${row.subjectType}:${row.subjectKey}`
              const isPending = setAccessMutation.isPending && pendingIdentityKey === identityKey
              const liveSession = row.activeSessions > 0
              const isVendor = row.subjectType === 'vendor'

              return (
                <article key={identityKey} className="mod-card space-y-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">{row.displayName}</p>
                        <Badge variant="outline" className="text-[10px] capitalize">{row.subjectType}</Badge>
                        <Badge variant="outline" className={cn('text-[10px]',
                          row.isActive ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'
                        )}>
                          {row.isActive ? 'active' : 'disabled'}
                        </Badge>
                        {liveSession && (
                          <span className="flex items-center gap-1 text-[10px] text-success">
                            <span className="pulse-dot" />
                            live
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p className="truncate">{row.contact}</p>
                        <p className="truncate capitalize">{row.roleLabel}</p>
                        {row.statusNote && <p className="truncate">Note: {row.statusNote}</p>}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={isPending || row.isActive}
                        onClick={() => onSetAccess(row.subjectType, row.subjectKey, true, row.displayName)}
                        className="gap-1.5 text-xs">
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        Activate
                      </Button>
                      <Button type="button" variant="destructive" size="sm" disabled={isPending || !row.isActive}
                        onClick={() => onSetAccess(row.subjectType, row.subjectKey, false, row.displayName)}
                        className="gap-1.5 text-xs">
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                        Disable
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-6">
                    <Metric label="Active sessions" value={row.activeSessions.toString()} />
                    <Metric label="Total sessions" value={row.totalSessions.toString()} />
                    <Metric label="Logged time" value={formatDuration(row.totalTimeSeconds)} />
                    <Metric label="Last accessed" value={formatDate(row.lastAccessedAt)} />
                    <Metric label="Session started" value={formatDate(row.lastSessionStartedAt)} />
                    <Metric label="Registered" value={formatDate(row.registeredAt)} />
                  </div>

                  {!isVendor && (
                    <p className="text-[10px] text-muted-foreground/50">
                      Session telemetry is tracked for vendors. User metrics may show as zero.
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card rounded-xl border border-border bg-card px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  )
}
