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
    return { pending, approved, rejected, total: submissions.length }
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
      await rejectSubmissionMutation.mutateAsync({ submissionId, rejectionReason: reason })
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
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
        <p className="text-sm font-semibold">Unable to load relocation submissions</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {submissionsQuery.error instanceof Error ? submissionsQuery.error.message : 'Please retry shortly.'}
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => submissionsQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {schemaMissing && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Schema setup required</AlertTitle>
          <AlertDescription className="text-xs">
            Relocation moderation tables are not yet in Supabase. Apply migrations before using this module.
          </AlertDescription>
        </Alert>
      )}

      {!schemaMissing && submissionsQuery.isLoading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading relocation submissions...</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="stagger-children grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Clock} label="Pending Review" value={stats.pending} color="text-warning" />
            <StatCard icon={CheckCircle} label="Published" value={stats.approved} color="text-success" />
            <StatCard icon={XCircle} label="Rejected" value={stats.rejected} color="text-destructive" />
            <StatCard icon={ListChecks} label="Total" value={stats.total} color="text-foreground" />
          </div>

          {/* Tab bar */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Relocation Catalog Moderation</h3>
              <p className="text-xs text-muted-foreground">
                Users submit movers, vehicles, zones, and pricing updates. Only approved items are published.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <TabBtn active={activeTab === 'submit'} onClick={() => setActiveTab('submit')} icon={UserPlus} label="User Submission" />
              <TabBtn active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} icon={FileWarning} label={`Queue (${stats.pending})`} />
              <TabBtn active={activeTab === 'published'} onClick={() => setActiveTab('published')} icon={FileCheck} label={`Published (${stats.approved})`} />
            </div>
          </div>

          {/* Submit tab */}
          {activeTab === 'submit' && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Submit Data For Approval</h3>
                <p className="text-xs text-muted-foreground">
                  Capture user/partner submissions that require admin moderation.
                </p>
              </div>
              <div className="accent-line" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormSelect label="Submission Type" id="submission-type" value={form.type}
                  onChange={(v) => setForm(prev => ({ ...prev, type: v as RelocationSubmissionType }))}
                  options={Object.entries(relocationSubmissionTypeLabels).map(([value, label]) => ({ value, label }))} />
                <FormSelect label="Source" id="submission-source" value={form.source}
                  onChange={(v) => setForm(prev => ({ ...prev, source: v as SubmissionSource }))}
                  options={Object.entries(sourceLabels).map(([value, label]) => ({ value, label }))} />
                <FormField label="Location" id="submission-location" placeholder="City / Zone"
                  value={form.location} onChange={(v) => setForm(prev => ({ ...prev, location: v }))} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Title" id="submission-title" placeholder="e.g. 5 Ton Truck - Nairobi"
                  value={form.title} onChange={(v) => setForm(prev => ({ ...prev, title: v }))} />
                <FormField label="Payload Summary" id="payload-summary" placeholder="Short summary for queue"
                  value={form.payloadSummary} onChange={(v) => setForm(prev => ({ ...prev, payloadSummary: v }))} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField label="Submitted By" id="submitted-by" placeholder="Contact person"
                  value={form.submittedBy} onChange={(v) => setForm(prev => ({ ...prev, submittedBy: v }))} />
                <FormField label="Contact" id="submitter-contact" placeholder="Phone or email"
                  value={form.submitterContact} onChange={(v) => setForm(prev => ({ ...prev, submitterContact: v }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submission-notes" className="text-xs">Notes</Label>
                <Textarea id="submission-notes" placeholder="Any supporting context" value={form.notes}
                  onChange={(event) => setForm(prev => ({ ...prev, notes: event.target.value }))} rows={3}
                  className="text-sm" />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleCreateSubmission} className="gap-1.5"
                  disabled={!canSubmit || createSubmissionMutation.isPending}>
                  {createSubmissionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit For Approval
                </Button>
              </div>
            </div>
          )}

          {/* Queue tab */}
          {activeTab === 'queue' && (
            <div className="space-y-3">
              {pendingSubmissions.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-12 text-center">
                  <CheckCircle className="mx-auto h-10 w-10 text-success mb-3" />
                  <p className="text-sm font-medium">All submissions reviewed</p>
                  <p className="text-xs text-muted-foreground mt-1">New user submissions will appear here.</p>
                </div>
              )}

              {pendingSubmissions.map(item => {
                const isProcessing = processingSubmissionId === item.id
                const mediaUrls = extractMediaUrlsFromPayload(item.payload)

                return (
                  <article key={item.id} className="mod-card mod-card--pending space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="text-sm font-semibold">{item.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {relocationSubmissionTypeLabels[item.type]} submitted by {item.submittedBy}
                        </p>
                      </div>
                      <Badge variant="outline" className="w-fit border-warning/30 bg-warning/10 text-warning text-[11px]">Pending</Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2 xl:grid-cols-5">
                      <InfoItem label="Contact" value={item.submitterContact} />
                      <InfoItem label="Source" value={sourceLabels[item.source]} />
                      <InfoItem label="Location" value={item.location} />
                      <InfoItem label="Submitted" value={formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })} />
                      <InfoItem label="Reference" value={item.id} />
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                      <p className="font-medium">Payload</p>
                      <p className="text-muted-foreground">{item.payloadSummary}</p>
                    </div>

                    <SubmissionMediaPreview urls={mediaUrls} emptyLabel="No media attached to this relocation submission." />

                    {item.notes && (
                      <div className="rounded-lg border border-border p-3 text-xs">
                        <p className="font-medium">Notes</p>
                        <p className="text-muted-foreground">{item.notes}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor={`reject-${item.id}`} className="text-xs">Rejection reason (required to reject)</Label>
                      <Textarea id={`reject-${item.id}`} placeholder="Explain why this needs changes"
                        value={rejectReasonById[item.id] ?? ''}
                        onChange={(event) => setRejectReasonById(prev => ({ ...prev, [item.id]: event.target.value }))}
                        rows={2} className="text-sm" />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleReject(item.id)} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Reject
                      </Button>
                      <Button size="sm" className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                        onClick={() => handleApprove(item.id)} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        Approve & Publish
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {/* Published tab */}
          {activeTab === 'published' && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {approvedSubmissions.length === 0 && (
                <div className="lg:col-span-2 rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
                  No published relocation entries yet.
                </div>
              )}

              {approvedSubmissions.map(item => {
                const mediaUrls = extractMediaUrlsFromPayload(item.payload)
                return (
                  <article key={item.id} className="mod-card mod-card--published space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold">{item.title}</h4>
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success text-[10px]">Live</Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {relocationSubmissionTypeLabels[item.type]} \u00b7 {item.location} \u00b7 {sourceLabels[item.source]}
                    </p>
                    <p className="text-muted-foreground">{item.payloadSummary}</p>
                    <SubmissionMediaPreview urls={mediaUrls} emptyLabel="No media attached." />
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Truck className="h-3 w-3" />
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

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('tab-btn', active ? 'tab-btn--active' : 'tab-btn--inactive')}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string }) {
  return (
    <div className="stat-card rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <p className={cn('mt-1 text-2xl font-bold tracking-tight', color)}>{value}</p>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium truncate">{value}</p>
    </div>
  )
}

function FormField({ label, id, placeholder, value, onChange }: { label: string; id: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />
    </div>
  )
}

function FormSelect({ label, id, value, onChange, options }: { label: string; id: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  )
}

function extractMediaUrlsFromPayload(payload: unknown): string[] {
  const mediaHints = ['image', 'photo', 'logo', 'banner', 'thumbnail', 'avatar', 'gallery', 'media']
  const results = new Set<string>()
  const visit = (value: unknown, keyHint: string) => {
    if (Array.isArray(value)) { value.forEach(item => visit(item, keyHint)); return }
    if (value && typeof value === 'object') { Object.entries(value).forEach(([key, nested]) => visit(nested, key.toLowerCase())); return }
    if (typeof value !== 'string') return
    const url = value.trim()
    if (!/^https?:\/\//i.test(url)) return
    const hint = keyHint.toLowerCase()
    const hinted = mediaHints.some(token => hint.includes(token))
    if (hinted || isImageLikeUrl(url)) results.add(url)
  }
  visit(payload, '')
  return Array.from(results)
}

function isImageLikeUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('/storage/v1/object/public/') ||
    lower.endsWith('.jpg') || lower.endsWith('.jpeg') ||
    lower.endsWith('.png') || lower.endsWith('.webp') ||
    lower.endsWith('.gif') || lower.endsWith('.heic') || lower.endsWith('.heif')
  )
}
