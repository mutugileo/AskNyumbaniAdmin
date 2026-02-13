-- Migration: Vendor item submissions + admin moderation for resale and decor
-- Date: 2026-02-09
-- Purpose:
--   - Let vendors/users submit resale/decor items
--   - Enforce admin approval before publishing
--   - Secure table access through RPC endpoints

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.marketplace_item_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  domain TEXT NOT NULL CHECK (domain IN ('resale', 'decor')),
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,

  submitted_by_name TEXT NOT NULL,
  submitted_by_contact TEXT NOT NULL,
  submitted_by_user_id UUID,
  source TEXT NOT NULL DEFAULT 'vendor' CHECK (source IN ('vendor', 'admin')),

  location TEXT NOT NULL,
  price NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'KES',
  description TEXT,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by_user_id UUID,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,

  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_submissions_domain_status
  ON public.marketplace_item_submissions(domain, status);

CREATE INDEX IF NOT EXISTS idx_marketplace_submissions_created_at
  ON public.marketplace_item_submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_submissions_published
  ON public.marketplace_item_submissions(published, domain);

CREATE OR REPLACE FUNCTION public.set_marketplace_submission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketplace_submissions_updated_at ON public.marketplace_item_submissions;
CREATE TRIGGER trg_marketplace_submissions_updated_at
BEFORE UPDATE ON public.marketplace_item_submissions
FOR EACH ROW
EXECUTE FUNCTION public.set_marketplace_submission_updated_at();

REVOKE ALL ON TABLE public.marketplace_item_submissions FROM anon;
REVOKE ALL ON TABLE public.marketplace_item_submissions FROM authenticated;

CREATE OR REPLACE VIEW public.marketplace_item_published AS
SELECT
  id,
  domain,
  item_type,
  title,
  location,
  price,
  currency,
  description,
  image_urls,
  payload,
  published_at,
  created_at,
  updated_at
FROM public.marketplace_item_submissions
WHERE status = 'approved'
  AND published = TRUE;

GRANT SELECT ON public.marketplace_item_published TO anon;
GRANT SELECT ON public.marketplace_item_published TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_marketplace_item_submission(
  p_domain TEXT,
  p_item_type TEXT,
  p_title TEXT,
  p_submitted_by_name TEXT,
  p_submitted_by_contact TEXT,
  p_location TEXT,
  p_price NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT 'KES',
  p_description TEXT DEFAULT NULL,
  p_image_urls JSONB DEFAULT '[]'::jsonb,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_submitted_by_user_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'vendor'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission_id UUID;
BEGIN
  IF p_domain NOT IN ('resale', 'decor') THEN
    RAISE EXCEPTION 'Invalid domain';
  END IF;

  IF COALESCE(BTRIM(p_item_type), '') = '' THEN
    RAISE EXCEPTION 'Item type is required';
  END IF;

  IF p_source NOT IN ('vendor', 'admin') THEN
    RAISE EXCEPTION 'Invalid source';
  END IF;

  INSERT INTO public.marketplace_item_submissions (
    domain,
    item_type,
    title,
    submitted_by_name,
    submitted_by_contact,
    submitted_by_user_id,
    source,
    location,
    price,
    currency,
    description,
    image_urls,
    payload,
    status,
    published
  )
  VALUES (
    p_domain,
    p_item_type,
    p_title,
    p_submitted_by_name,
    p_submitted_by_contact,
    p_submitted_by_user_id,
    p_source,
    p_location,
    p_price,
    COALESCE(NULLIF(p_currency, ''), 'KES'),
    p_description,
    COALESCE(p_image_urls, '[]'::jsonb),
    COALESCE(p_payload, '{}'::jsonb),
    'pending',
    FALSE
  )
  RETURNING id INTO v_submission_id;

  RETURN v_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_marketplace_item_submission(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  UUID,
  TEXT
) TO anon;

GRANT EXECUTE ON FUNCTION public.submit_marketplace_item_submission(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  TEXT,
  TEXT,
  JSONB,
  JSONB,
  UUID,
  TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_marketplace_item_submissions(
  p_session_token TEXT,
  p_domain TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS SETOF public.marketplace_item_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT * INTO v_admin
  FROM public.validate_admin_session(p_session_token)
  LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Invalid admin session token';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.marketplace_item_submissions mis
  WHERE (p_domain IS NULL OR mis.domain = p_domain)
    AND (p_status IS NULL OR mis.status = p_status)
  ORDER BY mis.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_marketplace_item_submissions(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_get_marketplace_item_submissions(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_marketplace_item_submission(
  p_session_token TEXT,
  p_submission_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT * INTO v_admin
  FROM public.validate_admin_session(p_session_token)
  LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Invalid admin session token';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;

  IF p_status = 'rejected' AND COALESCE(BTRIM(p_rejection_reason), '') = '' THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  UPDATE public.marketplace_item_submissions
  SET
    status = p_status,
    rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END,
    reviewed_by_user_id = v_admin.admin_user_id,
    reviewed_by_name = v_admin.full_name,
    reviewed_at = now(),
    published = (p_status = 'approved'),
    published_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END
  WHERE id = p_submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_marketplace_item_submission(TEXT, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_review_marketplace_item_submission(TEXT, UUID, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.marketplace_item_submissions IS
'Vendor/admin submitted resale/decor items awaiting moderation.';

COMMENT ON VIEW public.marketplace_item_published IS
'Published resale/decor items approved by admin.';
