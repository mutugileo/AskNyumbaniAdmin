'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  ExternalLink,
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
      setRejectReasonById(prev => { const next = { ...prev }; delete next[submissionId]; return next })
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
        <Alert className="border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>{title} schema missing</AlertTitle>
          <AlertDescription className="text-xs">
            Apply migration to enable vendor submissions and admin approvals.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="stagger-children grid grid-cols-1 gap-3 md:grid-cols-4">
        <MiniStat icon={Clock} label="Pending" value={stats.pending} color="text-warning" />
        <MiniStat icon={FileCheck} label="Published" value={stats.published} color="text-success" />
        <MiniStat icon={XCircle} label="Rejected" value={stats.rejected} color="text-destructive" />
        <MiniStat icon={Layers3} label="Total" value={stats.total} color="text-foreground" />
      </div>

      {/* Header + tabs */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
            <Link href={vendorPortalUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3" />
              Vendor Portal
            </Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <TabBtn active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} icon={FileWarning} label={`Queue (${stats.pending})`} />
          <TabBtn active={activeTab === 'published'} onClick={() => setActiveTab('published')} icon={FileCheck} label={`Published (${stats.published})`} />
          <TabBtn active={activeTab === 'submit'} onClick={() => setActiveTab('submit')} icon={PlusCircle} label="Add Item" />
        </div>
      </div>

      {/* Submit */}
      {activeTab === 'submit' && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Create Submission (Admin)</h3>
            <p className="text-xs text-muted-foreground">Add an item on behalf of a vendor/user. It still goes through moderation.</p>
          </div>
          <div className="accent-line" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={`${domain}-type`} className="text-xs">Item Type</Label>
              <select id={`${domain}-type`}
                className="flex h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.itemType} onChange={(e) => setForm(prev => ({ ...prev, itemType: e.target.value }))}>
                {itemTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${domain}-title`} className="text-xs">Title</Label>
              <Input id={`${domain}-title`} value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${domain}-location`} className="text-xs">Location</Label>
              <Input id={`${domain}-location`} value={form.location} onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))} className="h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`${domain}-name`} className="text-xs">Submitted By</Label>
              <Input id={`${domain}-name`} value={form.submittedBy} onChange={e => setForm(prev => ({ ...prev, submittedBy: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`${domain}-contact`} className="text-xs">Contact</Label>
              <Input id={`${domain}-contact`} value={form.submitterContact} onChange={e => setForm(prev => ({ ...prev, submitterContact: e.target.value }))} className="h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`${domain}-price`} className="text-xs">Price (optional)</Label>
              <Input id={`${domain}-price`} value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} placeholder="e.g. 25000" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor={`${domain}-currency`} className="text-xs">Currency</Label>
              <Input id={`${domain}-currency`} value={form.currency} onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))} className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${domain}-description`} className="text-xs">Description</Label>
            <Textarea id={`${domain}-description`} rows={3} value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} className="text-sm" />
          </div>

          {extraFields && extraFields.length > 0 && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div>
                <h4 className="text-xs font-semibold">{extraSectionTitle ?? 'Additional details'}</h4>
                {extraSectionDescription && <p className="text-[11px] text-muted-foreground">{extraSectionDescription}</p>}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {extraFields.map(field => {
                  const fieldValue = extraValues[field.id] ?? ''
                  const fieldId = `${domain}-${field.id}`
                  if (field.type === 'select') {
                    return (
                      <div key={field.id} className="space-y-1.5">
                        <Label htmlFor={fieldId} className="text-xs">{field.label}</Label>
                        <select id={fieldId}
                          className="flex h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                          value={fieldValue} onChange={e => setExtraValues(prev => ({ ...prev, [field.id]: e.target.value }))}>
                          {(field.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        {field.helpText && <p className="text-[10px] text-muted-foreground">{field.helpText}</p>}
                      </div>
                    )
                  }
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <Label htmlFor={fieldId} className="text-xs">{field.label}</Label>
                      <Input id={fieldId} type={field.type ?? 'text'} placeholder={field.placeholder} value={fieldValue}
                        onChange={e => setExtraValues(prev => ({ ...prev, [field.id]: e.target.value }))} className="h-9 text-sm" />
                      {field.helpText && <p className="text-[10px] text-muted-foreground">{field.helpText}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={!canSubmit || createSubmissionMutation.isPending || schemaMissing} className="gap-1.5">
              {createSubmissionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Add to Queue
            </Button>
          </div>
        </div>
      )}

      {/* Queue */}
      {activeTab === 'queue' && (
        <div className="space-y-3">
          {pending.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
              No pending submissions right now.
            </div>
          )}
          {pending.map(item => {
            const isProcessing = processingId === item.id
            return (
              <ModerationCard key={item.id} item={item} mode="queue" isProcessing={isProcessing}
                rejectReason={rejectReasonById[item.id] ?? ''}
                onRejectReasonChange={v => setRejectReasonById(prev => ({ ...prev, [item.id]: v }))}
                onApprove={() => handleApprove(item.id)} onReject={() => handleReject(item.id)} />
            )
          })}
        </div>
      )}

      {/* Published */}
      {activeTab === 'published' && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {published.length === 0 && (
            <div className="lg:col-span-2 rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
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

function ModerationCard({ item, mode, isProcessing, rejectReason, onRejectReasonChange, onApprove, onReject }: {
  item: MarketplaceSubmission; mode: 'queue' | 'published'; isProcessing: boolean
  rejectReason: string; onRejectReasonChange: (v: string) => void; onApprove: () => void; onReject: () => void
}) {
  return (
    <article className={cn('mod-card space-y-3', mode === 'published' ? 'mod-card--published' : 'mod-card--pending')}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{item.title}</h4>
        <Badge variant="outline" className={cn('text-[10px]',
          mode === 'published' ? 'border-success/30 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning'
        )}>
          {mode === 'published' ? 'Published' : 'Pending'}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{item.itemType} \u00b7 {item.location} \u00b7 {item.submittedBy}</p>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <InfoRow label="Contact" value={item.submitterContact} />
        <InfoRow label="Price" value={item.price != null ? `${item.currency} ${item.price.toLocaleString()}` : 'Not set'} />
        <InfoRow label="Submitted" value={formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })} />
      </div>

      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
      <SubmissionMediaPreview urls={item.imageUrls} emptyLabel="No media attached." />

      {mode === 'queue' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`reject-${item.id}`} className="text-xs">Rejection reason</Label>
            <Textarea id={`reject-${item.id}`} rows={2} value={rejectReason} onChange={e => onRejectReasonChange(e.target.value)} className="text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onReject} disabled={isProcessing} className="gap-1.5">
              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Reject
            </Button>
            <Button size="sm" onClick={onApprove} disabled={isProcessing} className="gap-1.5 bg-success text-success-foreground hover:bg-success/90">
              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
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
    <div className="rounded-lg border border-border bg-muted/30 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string }) {
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

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('tab-btn', active ? 'tab-btn--active' : 'tab-btn--inactive')}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
