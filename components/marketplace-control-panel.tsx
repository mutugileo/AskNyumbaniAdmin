'use client'

import Link from 'next/link'
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
  CreateMarketplaceSubmissionInput,
  MarketplaceDomain,
  MarketplaceSubmission,
  isMarketplaceSchemaMissing,
  useApproveMarketplaceSubmission,
  useCreateMarketplaceSubmission,
  useMarketplaceSubmissions,
  useRejectMarketplaceSubmission,
} from '@/lib/hooks/use-marketplace-moderation'
import { Json } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileCheck,
  FileWarning,
  Layers3,
  Loader2,
  PlusCircle,
  Send,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { SubmissionMediaPreview } from '@/components/submission-media-preview'

interface MarketplaceControlPanelProps {
  domain: MarketplaceDomain
  title: string
  description: string
  itemTypeOptions: string[]
  extraFields?: ExtraField[]
  extraSectionTitle?: string
  extraSectionDescription?: string
  buildPayload?: (form: AdminFormState, extraValues: Record<string, string>) => Json
  filterSubmission?: (item: MarketplaceSubmission) => boolean
}

interface AdminFormState {
  itemType: string
  title: string
  submittedBy: string
  submitterContact: string
  location: string
  price: string
  currency: string
  description: string
}

type PanelTab = 'submit' | 'queue' | 'published'

const defaultFormState: AdminFormState = {
  itemType: '',
  title: '',
  submittedBy: '',
  submitterContact: '',
  location: '',
  price: '',
  currency: 'KES',
  description: '',
}

interface ExtraField {
  id: string
  label: string
  placeholder?: string
  type?: 'text' | 'number' | 'select'
  options?: string[]
  helpText?: string
  defaultValue?: string
}

export function MarketplaceControlPanel({
  domain,
  title,
  description,
  itemTypeOptions,
  extraFields,
  extraSectionTitle,
  extraSectionDescription,
  buildPayload,
  filterSubmission,
}: MarketplaceControlPanelProps) {
  const vendorPortalUrl = process.env.NEXT_PUBLIC_VENDOR_PORTAL_URL ?? 'http://localhost:3001/vendor/submit'
  const [activeTab, setActiveTab] = useState<PanelTab>('queue')
  const [form, setForm] = useState<AdminFormState>({
    ...defaultFormState,
    itemType: itemTypeOptions[0] ?? '',
  })
  const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)

  const initialExtras = useMemo<Record<string, string>>(() => {
    if (!extraFields || extraFields.length === 0) return {}
    return extraFields.reduce<Record<string, string>>((acc, field) => {
      acc[field.id] = field.defaultValue ?? ''
      return acc
    }, {})
  }, [extraFields])
  const [extraValues, setExtraValues] = useState<Record<string, string>>(initialExtras)

  const submissionsQuery = useMarketplaceSubmissions(domain)
  const createSubmissionMutation = useCreateMarketplaceSubmission()
  const approveSubmissionMutation = useApproveMarketplaceSubmission()
  const rejectSubmissionMutation = useRejectMarketplaceSubmission()

  const schemaMissing = isMarketplaceSchemaMissing(submissionsQuery.error)

  const rawSubmissions = submissionsQuery.data ?? []
  const submissions = filterSubmission ? rawSubmissions.filter(filterSubmission) : rawSubmissions
  const pending = submissions.filter(item => item.status === 'pending')
  const published = submissions.filter(item => item.status === 'approved' && item.published)
  const rejectedCount = submissions.filter(item => item.status === 'rejected').length

  const stats = useMemo(
    () => ({ pending: pending.length, published: published.length, rejected: rejectedCount, total: submissions.length }),
    [pending.length, published.length, rejectedCount, submissions.length]
  )

  const canSubmit =
    form.itemType.trim() &&
    form.title.trim() &&
    form.submittedBy.trim() &&
    form.submitterContact.trim() &&
    form.location.trim()

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Fill all required fields before submitting.')
      return
    }

    const parsedPrice = form.price.trim() ? Number(form.price) : null
    if (form.price.trim() && Number.isNaN(parsedPrice)) {
      toast.error('Price must be a valid number')
      return
    }

    const payload: CreateMarketplaceSubmissionInput = {
      domain,
      itemType: form.itemType,
      title: form.title.trim(),
      submittedBy: form.submittedBy.trim(),
      submitterContact: form.submitterContact.trim(),
      location: form.location.trim(),
      price: parsedPrice,
      currency: form.currency.trim() || 'KES',
      description: form.description.trim(),
      source: 'admin',
      imageUrls: [],
      payload: buildPayload ? buildPayload(form, extraValues) : {},
    }

    try {
      await createSubmissionMutation.mutateAsync(payload)
      setForm({ ...defaultFormState, itemType: itemTypeOptions[0] ?? '', currency: 'KES' })
      setExtraValues(initialExtras)
      setActiveTab('queue')
      toast.success('Submission added to approval queue.')
    } catch (error) {
      console.error('Create marketplace submission failed:', error)
      toast.error('Failed to submit item. Please retry.')
    }
  }

  const handleApprove = async (submissionId: string) => {
    setProcessingId(submissionId)
    try {
      await approveSubmissionMutation.mutateAsync({ submissionId })
      toast.success('Item approved and published.')
    } catch (error) {
      console.error('Approve marketplace submission failed:', error)
      toast.error('Approval failed. Please retry.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (submissionId: string) => {
    const reason = (rejectReasonById[submissionId] ?? '').trim()
    if (!reason) {
      toast.error('Provide a rejection reason first.')
      return
    }

    setProcessingId(submissionId)
    try {
      await rejectSubmissionMutation.mutateAsync({ submissionId, rejectionReason: reason })
      setRejectReasonById(prev => {
        const next = { ...prev }
        delete next[submissionId]
        return next
      })
      toast.success('Item rejected.')
    } catch (error) {
      console.error('Reject marketplace submission failed:', error)
      toast.error('Rejection failed. Please retry.')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {schemaMissing && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{title} schema missing</AlertTitle>
          <AlertDescription>
            Apply migration <code className="rounded bg-muted px-1.5 py-0.5 text-xs">supabase/migrations/20260209113000_marketplace_submission_moderation.sql</code>
            to enable vendor submissions and admin approvals.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard icon={Clock} title="Pending" value={stats.pending} hint="Awaiting review" />
        <StatCard icon={FileCheck} title="Published" value={stats.published} hint="Visible in app" />
        <StatCard icon={XCircle} title="Rejected" value={stats.rejected} hint="Needs correction" />
        <StatCard icon={Layers3} title="Total" value={stats.total} hint="All submissions" />
      </div>

      <section className="space-y-3 rounded-lg border border-border/70 bg-background/70 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={vendorPortalUrl} target="_blank" rel="noreferrer">
              Open Vendor Portal
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <TabButton active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} icon={FileWarning} label={`Queue (${stats.pending})`} />
          <TabButton active={activeTab === 'published'} onClick={() => setActiveTab('published')} icon={FileCheck} label={`Published (${stats.published})`} />
          <TabButton active={activeTab === 'submit'} onClick={() => setActiveTab('submit')} icon={PlusCircle} label="Add Item" />
        </div>
      </section>

      {activeTab === 'submit' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Submission (Admin)</CardTitle>
            <CardDescription>Add an item on behalf of a vendor/user. It still goes through moderation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`${domain}-type`}>Item Type</Label>
                <select
                  id={`${domain}-type`}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={form.itemType}
                  onChange={(event) => setForm(prev => ({ ...prev, itemType: event.target.value }))}
                >
                  {itemTypeOptions.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${domain}-title`}>Title</Label>
                <Input id={`${domain}-title`} value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${domain}-location`}>Location</Label>
                <Input id={`${domain}-location`} value={form.location} onChange={event => setForm(prev => ({ ...prev, location: event.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${domain}-name`}>Submitted By</Label>
                <Input id={`${domain}-name`} value={form.submittedBy} onChange={event => setForm(prev => ({ ...prev, submittedBy: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${domain}-contact`}>Contact</Label>
                <Input id={`${domain}-contact`} value={form.submitterContact} onChange={event => setForm(prev => ({ ...prev, submitterContact: event.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${domain}-price`}>Price (optional)</Label>
                <Input id={`${domain}-price`} value={form.price} onChange={event => setForm(prev => ({ ...prev, price: event.target.value }))} placeholder="e.g. 25000" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`${domain}-currency`}>Currency</Label>
                <Input id={`${domain}-currency`} value={form.currency} onChange={event => setForm(prev => ({ ...prev, currency: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${domain}-description`}>Description</Label>
              <Textarea
                id={`${domain}-description`}
                rows={4}
                value={form.description}
                onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
              />
            </div>

            {extraFields && extraFields.length > 0 && (
              <div className="rounded-lg border p-4 space-y-4">
                <div className="space-y-1">
                  <h3 className="font-semibold">{extraSectionTitle ?? 'Additional details'}</h3>
                  {extraSectionDescription && (
                    <p className="text-sm text-muted-foreground">{extraSectionDescription}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {extraFields.map(field => {
                    const fieldValue = extraValues[field.id] ?? ''
                    const fieldId = `${domain}-${field.id}`
                    if (field.type === 'select') {
                      return (
                        <div key={field.id} className="space-y-2">
                          <Label htmlFor={fieldId}>{field.label}</Label>
                          <select
                            id={fieldId}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            value={fieldValue}
                            onChange={event =>
                              setExtraValues(prev => ({ ...prev, [field.id]: event.target.value }))
                            }
                          >
                            {(field.options ?? []).map(option => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          {field.helpText && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
                          )}
                        </div>
                      )
                    }

                    return (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={fieldId}>{field.label}</Label>
                        <Input
                          id={fieldId}
                          type={field.type ?? 'text'}
                          placeholder={field.placeholder}
                          value={fieldValue}
                          onChange={event =>
                            setExtraValues(prev => ({ ...prev, [field.id]: event.target.value }))
                          }
                        />
                        {field.helpText && (
                          <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={!canSubmit || createSubmissionMutation.isPending || schemaMissing} className="gap-2">
                {createSubmissionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Add to Queue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'queue' && (
        <div className="space-y-4">
          {pending.length === 0 && (
            <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              No pending submissions right now.
            </div>
          )}

          {pending.map(item => {
            const isProcessing = processingId === item.id
            return (
              <ModerationCard
                key={item.id}
                item={item}
                mode="queue"
                isProcessing={isProcessing}
                rejectReason={rejectReasonById[item.id] ?? ''}
                onRejectReasonChange={value => setRejectReasonById(prev => ({ ...prev, [item.id]: value }))}
                onApprove={() => handleApprove(item.id)}
                onReject={() => handleReject(item.id)}
              />
            )
          })}
        </div>
      )}

      {activeTab === 'published' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {published.length === 0 && (
            <div className="lg:col-span-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              No published items yet.
            </div>
          )}

          {published.map(item => (
            <ModerationCard key={item.id} item={item} mode="published" isProcessing={false} rejectReason="" onRejectReasonChange={() => {}} onApprove={() => {}} onReject={() => {}} />
          ))}
        </div>
      )}
    </div>
  )
}

function ModerationCard({
  item,
  mode,
  isProcessing,
  rejectReason,
  onRejectReasonChange,
  onApprove,
  onReject,
}: {
  item: MarketplaceSubmission
  mode: 'queue' | 'published'
  isProcessing: boolean
  rejectReason: string
  onRejectReasonChange: (value: string) => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <article className={cn('space-y-3 rounded-2xl border bg-background/80 p-4 sm:p-5', mode === 'published' ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-yellow-500')}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-base font-semibold">{item.title}</h4>
        <Badge variant={mode === 'published' ? 'default' : 'secondary'}>{mode === 'published' ? 'Published' : 'Pending'}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {item.itemType} · {item.location} · {item.submittedBy}
      </p>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <InfoRow label="Contact" value={item.submitterContact} />
        <InfoRow label="Price" value={item.price != null ? `${item.currency} ${item.price.toLocaleString()}` : 'Not set'} />
        <InfoRow label="Submitted" value={formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })} />
      </div>

      {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}

      <SubmissionMediaPreview
        urls={item.imageUrls}
        emptyLabel="No media attached to this submission."
      />

      {mode === 'queue' && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`reject-${item.id}`}>Rejection reason</Label>
            <Textarea id={`reject-${item.id}`} rows={2} value={rejectReason} onChange={event => onRejectReasonChange(event.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onReject} disabled={isProcessing} className="gap-2">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Reject
            </Button>
            <Button onClick={onApprove} disabled={isProcessing} className="gap-2 bg-green-600 text-white hover:bg-green-700">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Approve
            </Button>
          </div>
        </>
      )}
    </article>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function StatCard({
  icon: Icon,
  title,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  value: number
  hint: string
}) {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{value}</div>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
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
    <Button type="button" variant={active ? 'default' : 'outline'} onClick={onClick} className={cn('gap-2', !active && 'bg-background')}>
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  )
}
