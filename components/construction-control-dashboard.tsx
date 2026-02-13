'use client'

 import { MarketplaceControlPanel } from '@/components/marketplace-control-panel'
 import { MarketplaceSubmission, constructItemTypes } from '@/lib/hooks/use-marketplace-moderation'
 import { Json } from '@/lib/types/database'

 const buildStageOptions = [
   'foundation',
   'walling',
   'roofing',
   'plumbing_electrical',
   'finishing',
 ]

 const deliveryOptions = ['yes', 'no']
 const conditionOptions = ['new', 'leftover']

 function parseNumber(value: string): number | null {
   const trimmed = value.trim()
   if (!trimmed) return null
   const parsed = Number(trimmed)
   return Number.isFinite(parsed) ? parsed : null
 }

 function parseIntValue(value: string): number | null {
   const trimmed = value.trim()
   if (!trimmed) return null
   const parsed = Number.parseInt(trimmed, 10)
   return Number.isFinite(parsed) ? parsed : null
 }

 function getPayloadObject(payload: MarketplaceSubmission['payload']): Record<string, unknown> {
   if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
     return payload as Record<string, unknown>
   }
   return {}
 }

 function isConstructSubmission(item: MarketplaceSubmission): boolean {
   const payload = getPayloadObject(item.payload)
   const moduleValue = String(payload.module ?? '').toLowerCase()
   if (moduleValue === 'construct' || moduleValue === 'construction') return true
   return Boolean(payload.build_stage || payload.material_name)
 }

 export function ConstructionControlDashboard() {
   return (
     <MarketplaceControlPanel
       domain="resale"
       title="Construction Materials"
       description="Review construction material submissions before they appear in the Construct section of the app."
       itemTypeOptions={constructItemTypes}
       filterSubmission={isConstructSubmission}
       extraSectionTitle="Material details"
       extraSectionDescription="These fields power the construct catalog (stage, unit, stock, and supplier details)."
       extraFields={[
         { id: 'build_stage', label: 'Build stage', type: 'select', options: buildStageOptions, defaultValue: buildStageOptions[0] },
         { id: 'unit', label: 'Unit label', placeholder: 'bag, tonne, piece' },
         { id: 'coverage_per_unit', label: 'Coverage per unit', placeholder: 'e.g. 20', type: 'number' },
         { id: 'coverage_unit_label', label: 'Coverage unit', placeholder: 'sqm, m2' },
         { id: 'quantity_available', label: 'Quantity available', placeholder: 'e.g. 120', type: 'number' },
         { id: 'seller_name', label: 'Supplier name', placeholder: 'Vendor or supplier name' },
         { id: 'vendor_name', label: 'Business name (optional)', placeholder: 'Vendor brand' },
         { id: 'delivery_available', label: 'Delivery available', type: 'select', options: deliveryOptions, defaultValue: deliveryOptions[1] },
         { id: 'condition', label: 'Condition', type: 'select', options: conditionOptions, defaultValue: conditionOptions[0] },
         { id: 'material_name', label: 'Material name (optional)', placeholder: 'Defaults to title' },
       ]}
       buildPayload={(form, extraValues): Json => {
         const payload: Record<string, unknown> = {
           module: 'construct',
           build_stage: extraValues.build_stage?.trim() || null,
           unit: extraValues.unit?.trim() || null,
           coverage_per_unit: parseNumber(extraValues.coverage_per_unit ?? ''),
           coverage_unit_label: extraValues.coverage_unit_label?.trim() || null,
           quantity_available: parseIntValue(extraValues.quantity_available ?? ''),
           seller_name: extraValues.seller_name?.trim() || form.submittedBy.trim() || null,
           vendor_name: extraValues.vendor_name?.trim() || null,
           delivery_available: (extraValues.delivery_available ?? 'no') === 'yes',
           condition: extraValues.condition?.trim() || null,
           material_name: extraValues.material_name?.trim() || form.title.trim(),
           price_per_unit: parseIntValue(form.price),
         }

         return payload as Json
       }}
     />
   )
 }
