-- Migration: Secure relocation moderation access
-- Date: 2026-02-09
-- Purpose:
--   - Prevent direct anon/admin table mutations from client
--   - Gate admin queue + approvals through validated admin session token
--   - Keep public submission path available

REVOKE ALL ON TABLE public.relocation_catalog_submissions FROM anon;
REVOKE ALL ON TABLE public.relocation_catalog_submissions FROM authenticated;

CREATE OR REPLACE FUNCTION public.submit_relocation_catalog_submission(
  p_submission_type TEXT,
  p_title TEXT,
  p_submitted_by_name TEXT,
  p_submitted_by_contact TEXT,
  p_location TEXT,
  p_payload_summary TEXT,
  p_notes TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT 'mobile_user',
  p_submitted_by_user_id UUID DEFAULT NULL,
  p_admin_session_token TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission_id UUID;
  v_admin RECORD;
BEGIN
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

  IF p_source NOT IN ('admin', 'mobile_user', 'partner_portal') THEN
    RAISE EXCEPTION 'Invalid submission source';
  END IF;

  IF p_source = 'admin' THEN
    SELECT * INTO v_admin
    FROM public.validate_admin_session(p_admin_session_token)
    LIMIT 1;

    IF v_admin IS NULL THEN
      RAISE EXCEPTION 'Invalid admin session token';
    END IF;
  END IF;

  INSERT INTO public.relocation_catalog_submissions (
    submission_type,
    title,
    submitted_by_name,
    submitted_by_contact,
    submitted_by_user_id,
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
    p_submitted_by_contact,
    p_submitted_by_user_id,
    p_source,
    p_location,
    p_payload_summary,
    COALESCE(p_payload, '{}'::jsonb),
    p_notes,
    'pending',
    FALSE
  )
  RETURNING id INTO v_submission_id;

  RETURN v_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_relocation_catalog_submission(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  TEXT,
  UUID,
  TEXT
) TO anon;

GRANT EXECUTE ON FUNCTION public.submit_relocation_catalog_submission(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  TEXT,
  UUID,
  TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_relocation_submissions(
  p_session_token TEXT
)
RETURNS SETOF public.relocation_catalog_submissions
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
  FROM public.relocation_catalog_submissions
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_relocation_submissions(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_get_relocation_submissions(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_relocation_submission(
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

  UPDATE public.relocation_catalog_submissions
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

GRANT EXECUTE ON FUNCTION public.admin_review_relocation_submission(TEXT, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_review_relocation_submission(TEXT, UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.submit_relocation_catalog_submission IS
'Public+admin submission entrypoint for relocation moderation queue.';

COMMENT ON FUNCTION public.admin_get_relocation_submissions IS
'Returns relocation moderation queue after validating admin session token.';

COMMENT ON FUNCTION public.admin_review_relocation_submission IS
'Approves or rejects relocation submissions after validating admin session token.';
