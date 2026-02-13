# Vendor Submission Payload Contract and QA

## Scope
This document defines the payload contract for vendor submissions from the admin web app and the minimum QA checks before Android release.

## Prerequisites
1. Apply migrations:
   - `supabase/migrations/20260209130000_vendor_dashboard_media_and_resubmit.sql`
   - `supabase/migrations/20260209133000_vendor_auth_sessions_and_secure_rpcs.sql`
2. Set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (required for `/api/vendor/media`)

## Vendor Auth Contract
- OTP request RPC: `vendor_request_otp(p_submitted_by_contact, p_debug)`
- OTP verify RPC: `vendor_verify_otp(p_submitted_by_contact, p_otp_code, p_device_info)`
- Session validation RPC: `validate_vendor_session(p_session_token)`
- Session logout RPC: `vendor_logout(p_session_token)`

All vendor submit/read/resubmit operations must use `sessionToken`; contact-based mutation is not allowed.

## Marketplace Payload Contract
### Common fields (resale + decor)
- `domain`: `resale | decor`
- `item_type`
- `title`
- `submitted_by_name`
- `location`
- `price` (optional)
- `currency` (default `KES`)
- `description` (optional)
- `image_urls`: string[]
- `payload`: JSON object

### `resale` payload keys
- `condition`: `new | like new | good | used`
- `age_months`: number | null
- `original_price`: number | null
- `reason_for_selling`: string | null
- `media_urls`: string[]

### `decor` payload keys
- `style`: string | null
- `unit`: string | null
- `installation_days`: number | null
- `materials`: string[]
- `best_for`: string[]
- `vendor_id`: string | null
- `media_urls`: string[]

## Relocation Payload Contract
### Common fields
- `submission_type`: `mover_profile | vehicle | service_type | inventory_template | addon | coverage_zone | pricing_rule`
- `title`
- `submitted_by_name`
- `location`
- `payload_summary`
- `notes` (optional)
- `payload`: JSON object

### `mover_profile` payload keys
- `rating`: number | null
- `review_count`: number | null
- `eta_label`: string | null
- `badges`: string[]
- `starting_price`: number | null
- `supported_truck_ids`: string[]
- `media_urls`: string[]

### `vehicle` payload keys
- `truck_id`: `pickup | van | 3-ton | 5-ton | 10-ton`
- `label`: string | null
- `capacity_label`: string | null
- `base_fee`: number | null
- `crew`: number | null
- `media_urls`: string[]

### `inventory_template` payload keys
- `items`: array of
  - `id`: slug
  - `name`: string
  - `quantity`: number
  - `weight_factor`: number
- `media_urls`: string[]

### `addon` payload keys
- `price`: number | null
- `description`: string | null
- `media_urls`: string[]

### `service_type` payload keys
- `description`: string | null
- `base_fee`: number | null
- `media_urls`: string[]

### `coverage_zone` payload keys
- `radius_km`: number | null
- `notes`: string | null
- `media_urls`: string[]

### `pricing_rule` payload keys
- `multiplier`: number | null
- `applies_to`: string | null
- `media_urls`: string[]

## QA Checklist
1. Vendor OTP sign-in works and session persists after refresh.
2. Vendor submit page uploads images through `/api/vendor/media` only.
3. Reject a submission as admin, then resubmit from vendor dashboard.
4. Remove one previous image during resubmit and verify old media is deleted from `vendor-submissions` bucket.
5. Confirm approved records are visible to Android app via published endpoints.
6. Confirm no fallback/mock entries appear when Supabase data is empty or unavailable.
7. Confirm vendor actions are written to `vendor_activity_log` (`otp_requested`, `otp_verified`, create/resubmit events).
