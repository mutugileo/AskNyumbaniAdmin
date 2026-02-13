'use client'

import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  CreateRelocationSubmissionInput,
  RelocationSubmissionType,
  isRelocationSchemaMissing,
  relocationSubmissionTypeLabels,
  useApproveRelocationSubmission,
  useCreateRelocationSubmission,
  useRejectRelocationSubmission,
  useRelocationSubmissions,
} from '@/lib/hooks/use-relocation-moderation'
import { cn } from '@/lib/utils'
import { SubmissionMediaPreview } from '@/components/submission-media-preview'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileCheck,
  FileWarning,
  ListChecks,
  Loader2,
  Send,
  Truck,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

type SubmissionSource = 'admin' | 'mobile_user' | 'partner_portal'

interface NewSubmissionForm {
  type: RelocationSubmissionType
  title: string
  submittedBy: string
  submitterContact: string
  source: SubmissionSource
  location: string
  payloadSummary: string
  notes: string
}

const defaultForm: NewSubmissionForm = {
  type: 'mover_profile',
  title: '',
  submittedBy: '',
  submitterContact: '',
  source: 'mobile_user',
  location: '',
  payloadSummary: '',
  notes: '',
}

const sourceLabels: Record<SubmissionSource, string> = {
  admin: 'Admin Entry',
  mobile_user: 'Mobile User',
  partner_portal: 'Partner Portal',
}

const reviewTabs = ['submit', 'queue', 'published'] as const

type ReviewTab = (typeof reviewTabs)[number]

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: string }).message
    if (typeof message === 'string' && message.trim().length > 0) return message
  }
  return fallback
}

export function RelocationModerationDashboard() {
  const [activeTab, setActiveTab] = useState<ReviewTab>('submit')
  const [form, setForm] = useState<NewSubmissionForm>(defaultForm)
  const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({})
  const [processingSubmissionId, setProcessingSubmissionId] = useState<string | null>(null)

  const submissionsQuery = useRelocationSubmissions()
  const createSubmissionMutation = useCreateRelocationSubmission()
  const approveSubmissionMutation = useApproveRelocationSubmission()
  const rejectSubmissionMutation = useRejectRelocationSubmission()

  const schemaMissing = isRelocationSchemaMissing(submissionsQuery.error)
  const hasUnexpectedError = Boolean(submissionsQuery.error) && !schemaMissing

  const submissions = useMemo(() => submissionsQuery.data ?? [], [submissionsQuery.data])

  const stats = useMemo(() => {
    const pending = submissions.filter(item => item.status === 'pending').length
    const approved = submissions.filter(item => item.status === 'approved').length
    const rejected = submissions.filter(item => item.status === 'rejected').length

    return {
      pending,
      approved,
      rejected,
      total: submissions.length,
    }
  }, [submissions])

  const pendingSubmissions = useMemo(
    () => submissions.filter(item => item.status === 'pending'),
    [submissions]
  )

  const approvedSubmissions = useMemo(
    () => submissions.filter(item => item.status === 'approved' && item.published),
    [submissions]
  )

  const canSubmit =
    form.title.trim() &&
    form.submittedBy.trim() &&
    form.submitterContact.trim() &&
    form.location.trim() &&
    form.payloadSummary.trim()

  const handleCreateSubmission = async () => {
    if (!canSubmit) {
      toast.error('Fill all required fields before submitting for review.')
      return
    }
    if (schemaMissing) {
      toast.error('Relocation schema is missing. Apply migrations before submitting.')
      return
    }

    const payload: CreateRelocationSubmissionInput = {
      type: form.type,
      title: form.title.trim(),
      submittedBy: form.submittedBy.trim(),
      submitterContact: form.submitterContact.trim(),
      source: form.source,
      location: form.location.trim(),
      payloadSummary: form.payloadSummary.trim(),
      notes: form.notes.trim(),
      payload: {},
    }

    try {
      await createSubmissionMutation.mutateAsync(payload)

      setForm(defaultForm)
      setActiveTab('queue')
      toast.success('Submission sent for admin approval.')
    } catch (error) {
      console.error('Failed to create relocation submission:', error)
      toast.error(getErrorMessage(error, 'Failed to submit. Please retry.'))
    }
  }

  const handleApprove = async (submissionId: string) => {
    if (schemaMissing) {
      toast.error('Relocation schema is missing. Apply migrations before approving.')
      return
    }
    setProcessingSubmissionId(submissionId)

    try {
      await approveSubmissionMutation.mutateAsync({ submissionId })

      toast.success('Item approved and ready for app visibility.')
    } catch (error) {
      console.error('Failed to approve relocation submission:', error)
      toast.error(getErrorMessage(error, 'Approval failed. Please retry.'))
    } finally {
      setProcessingSubmissionId(null)
    }
  }

  const handleReject = async (submissionId: string) => {
    const reason = rejectReasonById[submissionId]?.trim()
    if (!reason) {
      toast.error('Add a rejection reason to continue.')
      return
    }
    if (schemaMissing) {
      toast.error('Relocation schema is missing. Apply migrations before rejecting.')
      return
    }

    setProcessingSubmissionId(submissionId)

    try {
      await rejectSubmissionMutation.mutateAsync({
        submissionId,
        rejectionReason: reason,
      })

      setRejectReasonById(prev => {
        const next = { ...prev }
        delete next[submissionId]
        return next
      })

      toast.success('Item rejected. Submitter can revise and resubmit.')
    } catch (error) {
      console.error('Failed to reject relocation submission:', error)
      toast.error(getErrorMessage(error, 'Rejection failed. Please retry.'))
    } finally {
      setProcessingSubmissionId(null)
    }
  }

  if (hasUnexpectedError) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-lg font-semibold">Unable to load relocation submissions</p>
            <p className="text-sm text-muted-foreground">
              {submissionsQuery.error instanceof Error ? submissionsQuery.error.message : 'Please retry shortly.'}
            </p>
            <Button type="button" variant="outline" onClick={() => submissionsQuery.refetch()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {schemaMissing && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Schema setup required</AlertTitle>
          <AlertDescription>
            Relocation moderation tables are not yet in Supabase. Apply migrations
            <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">supabase/migrations/20260209090000_relocation_catalog_moderation.sql</code>
            and
            <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">supabase/migrations/20260209100000_relocation_catalog_security.sql</code>
            before using this module.
          </AlertDescription>
        </Alert>
      )}

      {!schemaMissing && submissionsQuery.isLoading ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading relocation submissions...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Clock}
              title="Pending Review"
              value={stats.pending}
              hint="Awaiting decision"
              className="border-l-yellow-500"
              valueClassName="text-yellow-600"
            />
            <StatCard
              icon={CheckCircle}
              title="Published"
              value={stats.approved}
              hint="Visible in Android app"
              className="border-l-green-500"
              valueClassName="text-green-600"
            />
            <StatCard
              icon={XCircle}
              title="Rejected"
              value={stats.rejected}
              hint="Needs revision"
              className="border-l-red-500"
              valueClassName="text-red-600"
            />
            <StatCard
              icon={ListChecks}
              title="Total Submissions"
              value={stats.total}
              hint="All records"
              className="border-l-primary"
              valueClassName="text-primary"
            />
          </div>

          <section className="space-y-3 rounded-lg border border-border/70 bg-background/70 p-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Relocation Catalog Moderation</h3>
              <p className="text-sm text-muted-foreground">
                Users submit movers, vehicles, zones, and pricing updates. Only approved items should be published to the app.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <TabButton
                active={activeTab === 'submit'}
                onClick={() => setActiveTab('submit')}
                icon={UserPlus}
                label="User Submission"
              />
              <TabButton
                active={activeTab === 'queue'}
                onClick={() => setActiveTab('queue')}
                icon={FileWarning}
                label={`Approval Queue (${stats.pending})`}
              />
              <TabButton
                active={activeTab === 'published'}
                onClick={() => setActiveTab('published')}
                icon={FileCheck}
                label={`Published (${stats.approved})`}
              />
            </div>
          </section>

          {activeTab === 'submit' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submit Data For Approval</CardTitle>
                <CardDescription>
                  Use this to capture user/partner submissions that require admin moderation before they appear in the app.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="submission-type">Submission Type</Label>
                    <select
                      id="submission-type"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.type}
                      onChange={(event) =>
                        setForm(prev => ({
                          ...prev,
                          type: event.target.value as RelocationSubmissionType,
                        }))
                      }
                    >
                      {Object.entries(relocationSubmissionTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="submission-source">Source</Label>
                    <select
                      id="submission-source"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.source}
                      onChange={(event) =>
                        setForm(prev => ({
                          ...prev,
                          source: event.target.value as SubmissionSource,
                        }))
                      }
                    >
                      {Object.entries(sourceLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="submission-location">Location</Label>
                    <Input
                      id="submission-location"
                      placeholder="City / Zone"
                      value={form.location}
                      onChange={(event) => setForm(prev => ({ ...prev, location: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="submission-title">Title</Label>
                    <Input
                      id="submission-title"
                      placeholder="e.g. 5 Ton Truck - Nairobi"
                      value={form.title}
                      onChange={(event) => setForm(prev => ({ ...prev, title: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payload-summary">Payload Summary</Label>
                    <Input
                      id="payload-summary"
                      placeholder="Short summary used in approval queue"
                      value={form.payloadSummary}
                      onChange={(event) => setForm(prev => ({ ...prev, payloadSummary: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="submitted-by">Submitted By</Label>
                    <Input
                      id="submitted-by"
                      placeholder="Contact person"
                      value={form.submittedBy}
                      onChange={(event) => setForm(prev => ({ ...prev, submittedBy: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="submitter-contact">Contact</Label>
                    <Input
                      id="submitter-contact"
                      placeholder="Phone or email"
                      value={form.submitterContact}
                      onChange={(event) => setForm(prev => ({ ...prev, submitterContact: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="submission-notes">Notes</Label>
                  <Textarea
                    id="submission-notes"
                    placeholder="Any supporting context"
                    value={form.notes}
                    onChange={(event) => setForm(prev => ({ ...prev, notes: event.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleCreateSubmission}
                    className="gap-2"
                    disabled={!canSubmit || createSubmissionMutation.isPending}
                  >
                    {createSubmissionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {!createSubmissionMutation.isPending && <Send className="h-4 w-4" />}
                    Submit For Approval
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'queue' && (
            <div className="space-y-4">
              {pendingSubmissions.length === 0 && (
                <div className="rounded-lg border border-dashed py-12">
                  <div className="text-center space-y-2">
                    <CheckCircle className="mx-auto h-10 w-10 text-green-600" />
                    <p className="font-medium">All submissions reviewed</p>
                    <p className="text-sm text-muted-foreground">New user submissions will appear here.</p>
                  </div>
                </div>
              )}

              {pendingSubmissions.map(item => {
                const isProcessing = processingSubmissionId === item.id
                const mediaUrls = extractMediaUrlsFromPayload(item.payload)

                return (
                  <article key={item.id} className="space-y-4 rounded-2xl border border-l-4 border-l-yellow-500 bg-background/80 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="text-base font-semibold">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {relocationSubmissionTypeLabels[item.type]} submitted by {item.submittedBy}
                        </p>
                      </div>
                      <Badge variant="secondary" className="w-fit">Pending</Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
                      <InfoItem label="Contact" value={item.submitterContact} />
                      <InfoItem label="Source" value={sourceLabels[item.source]} />
                      <InfoItem label="Location" value={item.location} />
                      <InfoItem
                        label="Submitted"
                        value={formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      />
                      <InfoItem label="Reference" value={item.id} />
                    </div>

                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <p className="font-medium text-foreground">Payload</p>
                      <p className="text-muted-foreground">{item.payloadSummary}</p>
                    </div>

                    <SubmissionMediaPreview
                      urls={mediaUrls}
                      emptyLabel="No media attached to this relocation submission."
                    />

                    {item.notes && (
                      <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium text-foreground">Notes</p>
                        <p className="text-muted-foreground">{item.notes}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor={`reject-${item.id}`}>Rejection reason (required to reject)</Label>
                      <Textarea
                        id={`reject-${item.id}`}
                        placeholder="Explain why this needs changes"
                        value={rejectReasonById[item.id] ?? ''}
                        onChange={(event) =>
                          setRejectReasonById(prev => ({
                            ...prev,
                            [item.id]: event.target.value,
                          }))
                        }
                        rows={2}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button variant="outline" className="gap-2" onClick={() => handleReject(item.id)} disabled={isProcessing}>
                        {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                        {!isProcessing && <XCircle className="h-4 w-4" />}
                        Reject
                      </Button>
                      <Button
                        className="gap-2 bg-green-600 text-white hover:bg-green-700"
                        onClick={() => handleApprove(item.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                        {!isProcessing && <CheckCircle className="h-4 w-4" />}
                        Approve & Publish
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {activeTab === 'published' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {approvedSubmissions.length === 0 && (
                <div className="lg:col-span-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                  No published relocation entries yet.
                </div>
              )}

              {approvedSubmissions.map(item => {
                const mediaUrls = extractMediaUrlsFromPayload(item.payload)
                return (
                  <article key={item.id} className="space-y-2 rounded-2xl border border-l-4 border-l-green-500 bg-background/80 p-4 sm:p-5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-base font-semibold">{item.title}</h4>
                      <Badge className="bg-green-600 text-white hover:bg-green-700">Live</Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {relocationSubmissionTypeLabels[item.type]} · {item.location} · {sourceLabels[item.source]}
                    </p>
                    <p className="text-muted-foreground">{item.payloadSummary}</p>
                    <SubmissionMediaPreview
                      urls={mediaUrls}
                      emptyLabel="No media attached to this relocation submission."
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" />
                      <span>
                        Approved {item.reviewedAt ? formatDistanceToNow(new Date(item.reviewedAt), { addSuffix: true }) : 'recently'}
                        {item.reviewedBy ? ` by ${item.reviewedBy}` : ''}
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      className={cn('gap-2', !active && 'bg-background')}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  )
}

function StatCard({
  icon: Icon,
  title,
  value,
  hint,
  className,
  valueClassName,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  value: number
  hint: string
  className?: string
  valueClassName?: string
}) {
  return (
    <Card className={cn('border-l-4', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', valueClassName)}>{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function extractMediaUrlsFromPayload(payload: unknown): string[] {
  const mediaHints = ['image', 'photo', 'logo', 'banner', 'thumbnail', 'avatar', 'gallery', 'media']
  const results = new Set<string>()

  const visit = (value: unknown, keyHint: string) => {
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, keyHint))
      return
    }

    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, nested]) => visit(nested, key.toLowerCase()))
      return
    }

    if (typeof value !== 'string') return

    const url = value.trim()
    if (!/^https?:\/\//i.test(url)) return

    const hint = keyHint.toLowerCase()
    const hinted = mediaHints.some(token => hint.includes(token))
    if (hinted || isImageLikeUrl(url)) {
      results.add(url)
    }
  }

  visit(payload, '')
  return Array.from(results)
}

function isImageLikeUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('/storage/v1/object/public/') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.heic') ||
    lower.endsWith('.heif')
  )
}
