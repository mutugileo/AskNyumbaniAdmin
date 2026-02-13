-- Migration: Vendor OTP auth + session-secured vendor RPCs
-- Date: 2026-02-09
-- Purpose:
--   1) Add vendor OTP-based authentication and sessions
--   2) Secure vendor read/resubmit/submit RPCs using vendor session token
--   3) Add vendor activity log
--   4) Harden storage policy by removing anonymous direct uploads

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Vendor auth + activity tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by_contact TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_otp_contact_created
  ON public.vendor_otp_codes(LOWER(BTRIM(submitted_by_contact)), created_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_sessions (
  session_token TEXT PRIMARY KEY,
  submitted_by_contact TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  device_info TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_sessions_contact
  ON public.vendor_sessions(LOWER(BTRIM(submitted_by_contact)), created_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by_contact TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_activity_contact_created
  ON public.vendor_activity_log(LOWER(BTRIM(submitted_by_contact)), created_at DESC);

REVOKE ALL ON TABLE public.vendor_otp_codes FROM anon;
REVOKE ALL ON TABLE public.vendor_otp_codes FROM authenticated;
REVOKE ALL ON TABLE public.vendor_sessions FROM anon;
REVOKE ALL ON TABLE public.vendor_sessions FROM authenticated;
REVOKE ALL ON TABLE public.vendor_activity_log FROM anon;
REVOKE ALL ON TABLE public.vendor_activity_log FROM authenticated;

CREATE OR REPLACE FUNCTION public.log_vendor_activity(
  p_submitted_by_contact TEXT,
  p_activity_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vendor_activity_log (
    submitted_by_contact,
    activity_type,
    description,
    metadata
  )
  VALUES (
    p_submitted_by_contact,
    p_activity_type,
    p_description,
    p_metadata
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_vendor_activity(TEXT, TEXT, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.log_vendor_activity(TEXT, TEXT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_request_otp(
  p_submitted_by_contact TEXT,
  p_debug BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact TEXT;
  v_code TEXT;
  v_code_hash TEXT;
  v_expires_at TIMESTAMPTZ;
  v_recent_count INT;
BEGIN
  v_contact := LOWER(BTRIM(p_submitted_by_contact));

  IF COALESCE(v_contact, '') = '' THEN
    RAISE EXCEPTION 'Contact is required';
  END IF;

  SELECT COUNT(*)
  INTO v_recent_count
  FROM public.vendor_otp_codes
  WHERE LOWER(BTRIM(submitted_by_contact)) = v_contact
    AND created_at > now() - interval '10 minutes';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Too many OTP requests. Please wait and try again.';
  END IF;

  v_code := LPAD((FLOOR(RANDOM() * 1000000)::INT)::TEXT, 6, '0');
  v_code_hash := extensions.crypt(v_code, extensions.gen_salt('bf'));
  v_expires_at := now() + interval '10 minutes';

  INSERT INTO public.vendor_otp_codes (
    submitted_by_contact,
    code_hash,
    expires_at
  )
  VALUES (
    v_contact,
    v_code_hash,
    v_expires_at
  );

  PERFORM public.log_vendor_activity(
    v_contact,
    'otp_requested',
    'Vendor OTP requested',
    jsonb_build_object('expires_at', v_expires_at)
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'expires_at', v_expires_at,
    'debug_code', CASE WHEN p_debug THEN v_code ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_request_otp(TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_request_otp(TEXT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_verify_otp(
  p_submitted_by_contact TEXT,
  p_otp_code TEXT,
  p_device_info TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact TEXT;
  v_otp_record public.vendor_otp_codes%ROWTYPE;
  v_session_token TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_contact := LOWER(BTRIM(p_submitted_by_contact));

  IF COALESCE(v_contact, '') = '' THEN
    RAISE EXCEPTION 'Contact is required';
  END IF;

  IF COALESCE(BTRIM(p_otp_code), '') = '' THEN
    RAISE EXCEPTION 'OTP code is required';
  END IF;

  SELECT *
  INTO v_otp_record
  FROM public.vendor_otp_codes
  WHERE LOWER(BTRIM(submitted_by_contact)) = v_contact
    AND consumed = FALSE
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_otp_record.id IS NULL THEN
    RAISE EXCEPTION 'OTP expired or not found';
  END IF;

  IF extensions.crypt(BTRIM(p_otp_code), v_otp_record.code_hash) <> v_otp_record.code_hash THEN
    RAISE EXCEPTION 'Invalid OTP code';
  END IF;

  UPDATE public.vendor_otp_codes
  SET consumed = TRUE,
      consumed_at = now()
  WHERE id = v_otp_record.id;

  v_session_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_expires_at := now() + interval '30 days';

  INSERT INTO public.vendor_sessions (
    session_token,
    submitted_by_contact,
    expires_at,
    device_info,
    created_at,
    last_seen_at
  )
  VALUES (
    v_session_token,
    v_contact,
    v_expires_at,
    p_device_info,
    now(),
    now()
  );

  PERFORM public.log_vendor_activity(
    v_contact,
    'otp_verified',
    'Vendor OTP verified and session created',
    jsonb_build_object('expires_at', v_expires_at)
  );

  RETURN v_session_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_verify_otp(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_verify_otp(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_vendor_session(
  p_session_token TEXT
)
RETURNS TABLE (
  session_token TEXT,
  submitted_by_contact TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vs.session_token,
    vs.submitted_by_contact,
    vs.expires_at
  FROM public.vendor_sessions vs
  WHERE vs.session_token = p_session_token
    AND vs.revoked_at IS NULL
    AND vs.expires_at > now()
  LIMIT 1;

  UPDATE public.vendor_sessions
  SET last_seen_at = now()
  WHERE public.vendor_sessions.session_token = p_session_token
    AND public.vendor_sessions.revoked_at IS NULL
    AND public.vendor_sessions.expires_at > now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_vendor_session(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_vendor_session(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_logout(
  p_session_token TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact TEXT;
BEGIN
  SELECT submitted_by_contact
  INTO v_contact
  FROM public.vendor_sessions
  WHERE session_token = p_session_token
  LIMIT 1;

  UPDATE public.vendor_sessions
  SET revoked_at = now()
  WHERE session_token = p_session_token;

  IF v_contact IS NOT NULL THEN
    PERFORM public.log_vendor_activity(
      v_contact,
      'session_revoked',
      'Vendor session revoked',
      NULL
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_logout(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_logout(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Session-secured vendor submissions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_submit_marketplace_item_submission(
  p_session_token TEXT,
  p_item_type TEXT,
  p_title TEXT,
  p_submitted_by_name TEXT,
  p_location TEXT,
  p_price NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT 'KES',
  p_description TEXT DEFAULT NULL,
  p_image_urls JSONB DEFAULT '[]'::jsonb,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_domain TEXT DEFAULT 'resale'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor RECORD;
  v_submission_id UUID;
BEGIN
  SELECT *
  INTO v_vendor
  FROM public.validate_vendor_session(p_session_token)
  LIMIT 1;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Invalid vendor session';
  END IF;

  IF p_domain NOT IN ('resale', 'decor') THEN
    RAISE EXCEPTION 'Invalid domain';
  END IF;

  IF COALESCE(BTRIM(p_item_type), '') = '' THEN
    RAISE EXCEPTION 'Item type is required';
  END IF;

  INSERT INTO public.marketplace_item_submissions (
    domain,
    item_type,
    title,
    submitted_by_name,
    submitted_by_contact,
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
    v_vendor.submitted_by_contact,
    'vendor',
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

  PERFORM public.log_vendor_activity(
    v_vendor.submitted_by_contact,
    'marketplace_submission_created',
    'Vendor submitted marketplace item',
    jsonb_build_object('submission_id', v_submission_id, 'domain', p_domain)
  );

  RETURN v_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_submit_marketplace_item_submission(
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
  TEXT
) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_submit_marketplace_item_submission(
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
  TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_submit_relocation_catalog_submission(
  p_session_token TEXT,
  p_submission_type TEXT,
  p_title TEXT,
  p_submitted_by_name TEXT,
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
  v_vendor RECORD;
  v_submission_id UUID;
BEGIN
  SELECT *
  INTO v_vendor
  FROM public.validate_vendor_session(p_session_token)
  LIMIT 1;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Invalid vendor session';
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

  INSERT INTO public.relocation_catalog_submissions (
    submission_type,
    title,
    submitted_by_name,
    submitted_by_contact,
    source,
    location,
    payload_summary,
    payload,
    notes,
    status,
    published
  )
  VALUES (
    p_submission_type,
    p_title,
    p_submitted_by_name,
    v_vendor.submitted_by_contact,
    'partner_portal',
    p_location,
    p_payload_summary,
    COALESCE(p_payload, '{}'::jsonb),
    p_notes,
    'pending',
    FALSE
  )
  RETURNING id INTO v_submission_id;

  PERFORM public.log_vendor_activity(
    v_vendor.submitted_by_contact,
    'relocation_submission_created',
    'Vendor submitted relocation item',
    jsonb_build_object('submission_id', v_submission_id, 'submission_type', p_submission_type)
  );

  RETURN v_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_submit_relocation_catalog_submission(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_submit_relocation_catalog_submission(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO authenticated;

-- ---------------------------------------------------------------------------
-- Replace vendor read/resubmit RPCs to use vendor sessions
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.vendor_get_marketplace_item_submissions(TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.vendor_resubmit_marketplace_item_submission(
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
);
DROP FUNCTION IF EXISTS public.vendor_get_relocation_submissions(TEXT, INT);
DROP FUNCTION IF EXISTS public.vendor_resubmit_relocation_submission(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
);

CREATE OR REPLACE FUNCTION public.vendor_get_marketplace_item_submissions(
  p_session_token TEXT,
  p_domain TEXT DEFAULT NULL,
  p_limit INT DEFAULT 200
)
RETURNS SETOF public.marketplace_item_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor RECORD;
BEGIN
  SELECT *
  INTO v_vendor
  FROM public.validate_vendor_session(p_session_token)
  LIMIT 1;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Invalid vendor session';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.marketplace_item_submissions mis
  WHERE LOWER(BTRIM(mis.submitted_by_contact)) = LOWER(BTRIM(v_vendor.submitted_by_contact))
    AND (p_domain IS NULL OR mis.domain = p_domain)
  ORDER BY mis.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_get_marketplace_item_submissions(TEXT, TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_get_marketplace_item_submissions(TEXT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_resubmit_marketplace_item_submission(
  p_submission_id UUID,
  p_session_token TEXT,
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
  v_vendor RECORD;
  v_existing public.marketplace_item_submissions%ROWTYPE;
BEGIN
  SELECT *
  INTO v_vendor
  FROM public.validate_vendor_session(p_session_token)
  LIMIT 1;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Invalid vendor session';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.marketplace_item_submissions
  WHERE id = p_submission_id
    AND LOWER(BTRIM(submitted_by_contact)) = LOWER(BTRIM(v_vendor.submitted_by_contact))
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

  PERFORM public.log_vendor_activity(
    v_vendor.submitted_by_contact,
    'marketplace_submission_resubmitted',
    'Vendor resubmitted rejected marketplace item',
    jsonb_build_object('submission_id', p_submission_id, 'domain', v_existing.domain)
  );

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

CREATE OR REPLACE FUNCTION public.vendor_get_relocation_submissions(
  p_session_token TEXT,
  p_limit INT DEFAULT 200
)
RETURNS SETOF public.relocation_catalog_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor RECORD;
BEGIN
  SELECT *
  INTO v_vendor
  FROM public.validate_vendor_session(p_session_token)
  LIMIT 1;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Invalid vendor session';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.relocation_catalog_submissions rcs
  WHERE LOWER(BTRIM(rcs.submitted_by_contact)) = LOWER(BTRIM(v_vendor.submitted_by_contact))
  ORDER BY rcs.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_get_relocation_submissions(TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_get_relocation_submissions(TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_resubmit_relocation_submission(
  p_submission_id UUID,
  p_session_token TEXT,
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
  v_vendor RECORD;
  v_existing public.relocation_catalog_submissions%ROWTYPE;
BEGIN
  SELECT *
  INTO v_vendor
  FROM public.validate_vendor_session(p_session_token)
  LIMIT 1;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Invalid vendor session';
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
    AND LOWER(BTRIM(submitted_by_contact)) = LOWER(BTRIM(v_vendor.submitted_by_contact))
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

  PERFORM public.log_vendor_activity(
    v_vendor.submitted_by_contact,
    'relocation_submission_resubmitted',
    'Vendor resubmitted rejected relocation item',
    jsonb_build_object('submission_id', p_submission_id, 'submission_type', p_submission_type)
  );

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

-- ---------------------------------------------------------------------------
-- Storage hardening: remove direct anonymous uploads
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public upload vendor submissions" ON storage.objects;

COMMENT ON FUNCTION public.vendor_request_otp(TEXT, BOOLEAN) IS
'Requests OTP for vendor sign-in.';
COMMENT ON FUNCTION public.vendor_verify_otp(TEXT, TEXT, TEXT) IS
'Verifies OTP and returns vendor session token.';
COMMENT ON FUNCTION public.validate_vendor_session(TEXT) IS
'Validates vendor session token.';
