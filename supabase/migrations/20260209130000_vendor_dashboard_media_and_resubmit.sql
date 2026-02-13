-- Migration: Vendor dashboard APIs + media upload bucket
-- Date: 2026-02-09
-- Purpose:
--   1) Allow vendors to view their own submissions by contact
--   2) Allow vendors to edit + resubmit rejected records through secure RPCs
--   3) Add public upload bucket for vendor submission images

-- ---------------------------------------------------------------------------
-- Storage bucket for vendor submission media
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-submissions',
  'vendor-submissions',
  TRUE,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read vendor submissions" ON storage.objects;
CREATE POLICY "Public read vendor submissions"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'vendor-submissions');

DROP POLICY IF EXISTS "Public upload vendor submissions" ON storage.objects;
CREATE POLICY "Public upload vendor submissions"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'vendor-submissions');

-- ---------------------------------------------------------------------------
-- Vendor marketplace dashboard RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_get_marketplace_item_submissions(
  p_submitted_by_contact TEXT,
  p_domain TEXT DEFAULT NULL,
  p_limit INT DEFAULT 200
)
RETURNS SETOF public.marketplace_item_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(BTRIM(p_submitted_by_contact), '') = '' THEN
    RAISE EXCEPTION 'Submitted-by contact is required';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.marketplace_item_submissions mis
  WHERE LOWER(BTRIM(mis.submitted_by_contact)) = LOWER(BTRIM(p_submitted_by_contact))
    AND (p_domain IS NULL OR mis.domain = p_domain)
  ORDER BY mis.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_get_marketplace_item_submissions(TEXT, TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_get_marketplace_item_submissions(TEXT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_resubmit_marketplace_item_submission(
  p_submission_id UUID,
  p_submitted_by_contact TEXT,
  p_item_type TEXT,
  p_title TEXT,
  p_location TEXT,
  p_price NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT 'KES',
  p_description TEXT DEFAULT NULL,
  p_image_urls JSONB DEFAULT '[]'::jsonb,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.marketplace_item_submissions%ROWTYPE;
BEGIN
  IF COALESCE(BTRIM(p_submitted_by_contact), '') = '' THEN
    RAISE EXCEPTION 'Submitted-by contact is required';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.marketplace_item_submissions
  WHERE id = p_submission_id
    AND LOWER(BTRIM(submitted_by_contact)) = LOWER(BTRIM(p_submitted_by_contact))
  LIMIT 1;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_existing.status <> 'rejected' THEN
    RAISE EXCEPTION 'Only rejected submissions can be edited and resubmitted';
  END IF;

  UPDATE public.marketplace_item_submissions
  SET
    item_type = p_item_type,
    title = p_title,
    location = p_location,
    price = p_price,
    currency = COALESCE(NULLIF(p_currency, ''), 'KES'),
    description = p_description,
    image_urls = COALESCE(p_image_urls, '[]'::jsonb),
    payload = COALESCE(p_payload, '{}'::jsonb),
    status = 'pending',
    rejection_reason = NULL,
    reviewed_by_user_id = NULL,
    reviewed_by_name = NULL,
    reviewed_at = NULL,
    published = FALSE,
    published_at = NULL
  WHERE id = p_submission_id;

  RETURN p_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_resubmit_marketplace_item_submission(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  TEXT,
  TEXT,
  JSONB,
  JSONB
) TO anon;

GRANT EXECUTE ON FUNCTION public.vendor_resubmit_marketplace_item_submission(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  TEXT,
  TEXT,
  JSONB,
  JSONB
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Vendor relocation dashboard RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_get_relocation_submissions(
  p_submitted_by_contact TEXT,
  p_limit INT DEFAULT 200
)
RETURNS SETOF public.relocation_catalog_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(BTRIM(p_submitted_by_contact), '') = '' THEN
    RAISE EXCEPTION 'Submitted-by contact is required';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.relocation_catalog_submissions rcs
  WHERE LOWER(BTRIM(rcs.submitted_by_contact)) = LOWER(BTRIM(p_submitted_by_contact))
  ORDER BY rcs.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_get_relocation_submissions(TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_get_relocation_submissions(TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_resubmit_relocation_submission(
  p_submission_id UUID,
  p_submitted_by_contact TEXT,
  p_submission_type TEXT,
  p_title TEXT,
  p_location TEXT,
  p_payload_summary TEXT,
  p_notes TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.relocation_catalog_submissions%ROWTYPE;
BEGIN
  IF COALESCE(BTRIM(p_submitted_by_contact), '') = '' THEN
    RAISE EXCEPTION 'Submitted-by contact is required';
  END IF;

  IF p_submission_type NOT IN (
    'mover_profile',
    'vehicle',
    'service_type',
    'inventory_template',
    'addon',
    'coverage_zone',
    'pricing_rule'
  ) THEN
    RAISE EXCEPTION 'Invalid submission type';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.relocation_catalog_submissions
  WHERE id = p_submission_id
    AND LOWER(BTRIM(submitted_by_contact)) = LOWER(BTRIM(p_submitted_by_contact))
  LIMIT 1;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_existing.status <> 'rejected' THEN
    RAISE EXCEPTION 'Only rejected submissions can be edited and resubmitted';
  END IF;

  UPDATE public.relocation_catalog_submissions
  SET
    submission_type = p_submission_type,
    title = p_title,
    location = p_location,
    payload_summary = p_payload_summary,
    notes = p_notes,
    payload = COALESCE(p_payload, '{}'::jsonb),
    status = 'pending',
    rejection_reason = NULL,
    reviewed_by_user_id = NULL,
    reviewed_by_name = NULL,
    reviewed_at = NULL,
    published = FALSE,
    published_at = NULL
  WHERE id = p_submission_id;

  RETURN p_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_resubmit_relocation_submission(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO anon;

GRANT EXECUTE ON FUNCTION public.vendor_resubmit_relocation_submission(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO authenticated;

COMMENT ON FUNCTION public.vendor_get_marketplace_item_submissions IS
'Returns marketplace submissions for a vendor contact.';

COMMENT ON FUNCTION public.vendor_resubmit_marketplace_item_submission IS
'Allows vendor to edit and resubmit rejected marketplace submission by contact.';

COMMENT ON FUNCTION public.vendor_get_relocation_submissions IS
'Returns relocation submissions for a vendor contact.';

COMMENT ON FUNCTION public.vendor_resubmit_relocation_submission IS
'Allows vendor to edit and resubmit rejected relocation submission by contact.';
