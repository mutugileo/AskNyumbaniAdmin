-- Migration: Admin identity access controls + session visibility
-- Date: 2026-02-13
-- Purpose:
--   1) Allow admin to activate/disable user and vendor identities.
--   2) Provide a unified admin RPC for user/vendor account + session overview.
--   3) Enforce vendor disable state during session validation and OTP login.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.identity_access_controls (
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user', 'vendor')),
  subject_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  status_note TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_type, subject_key)
);

CREATE INDEX IF NOT EXISTS idx_identity_access_controls_active
  ON public.identity_access_controls(subject_type, is_active);

CREATE OR REPLACE FUNCTION public.touch_identity_access_controls_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_identity_access_controls_updated_at ON public.identity_access_controls;
CREATE TRIGGER trg_identity_access_controls_updated_at
BEFORE UPDATE ON public.identity_access_controls
FOR EACH ROW
EXECUTE FUNCTION public.touch_identity_access_controls_updated_at();

CREATE OR REPLACE FUNCTION public.admin_get_identity_access_overview(
  p_session_token TEXT,
  p_limit INT DEFAULT 500
)
RETURNS TABLE (
  subject_type TEXT,
  subject_key TEXT,
  display_name TEXT,
  contact TEXT,
  role_label TEXT,
  is_active BOOLEAN,
  status_note TEXT,
  active_sessions INT,
  total_sessions INT,
  total_time_seconds BIGINT,
  last_accessed_at TIMESTAMPTZ,
  last_session_started_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_session RECORD;
BEGIN
  SELECT *
  INTO v_admin_session
  FROM public.validate_admin_session(p_session_token)
  LIMIT 1;

  IF v_admin_session IS NULL THEN
    RAISE EXCEPTION 'Invalid admin session';
  END IF;

  RETURN QUERY
  WITH user_rows AS (
    SELECT
      'user'::TEXT AS subject_type,
      p.id::TEXT AS subject_key,
      COALESCE(NULLIF(BTRIM(p.full_name), ''), 'User') AS display_name,
      COALESCE(NULLIF(BTRIM(p.email), ''), NULLIF(BTRIM(p.phone_number), ''), p.id::TEXT) AS contact,
      COALESCE(p.user_type::TEXT, 'user') AS role_label,
      COALESCE(ctrl.is_active, TRUE) AS is_active,
      ctrl.status_note AS status_note,
      0::INT AS active_sessions,
      0::INT AS total_sessions,
      0::BIGINT AS total_time_seconds,
      NULL::TIMESTAMPTZ AS last_accessed_at,
      NULL::TIMESTAMPTZ AS last_session_started_at,
      p.created_at AS registered_at
    FROM public.profiles p
    LEFT JOIN public.identity_access_controls ctrl
      ON ctrl.subject_type = 'user'
     AND ctrl.subject_key = p.id::TEXT
  ),
  vendor_contacts AS (
    SELECT DISTINCT LOWER(BTRIM(src.contact)) AS contact_key
    FROM (
      SELECT submitted_by_contact AS contact FROM public.vendor_sessions
      UNION ALL
      SELECT submitted_by_contact AS contact
      FROM public.marketplace_item_submissions
      WHERE source = 'vendor'
      UNION ALL
      SELECT submitted_by_contact AS contact
      FROM public.relocation_catalog_submissions
      WHERE source = 'partner_portal'
    ) src
    WHERE COALESCE(BTRIM(src.contact), '') <> ''
  ),
  vendor_session_stats AS (
    SELECT
      LOWER(BTRIM(vs.submitted_by_contact)) AS contact_key,
      COUNT(*)::INT AS total_sessions,
      COUNT(*) FILTER (
        WHERE vs.revoked_at IS NULL
          AND vs.expires_at > now()
      )::INT AS active_sessions,
      COALESCE(
        SUM(
          GREATEST(
            EXTRACT(
              EPOCH FROM (
                LEAST(COALESCE(vs.revoked_at, vs.expires_at, now()), now()) - vs.created_at
              )
            )::BIGINT,
            0
          )
        ),
        0
      )::BIGINT AS total_time_seconds,
      MAX(vs.last_seen_at) AS last_accessed_at,
      MAX(vs.created_at) AS last_session_started_at,
      MIN(vs.created_at) AS first_session_at
    FROM public.vendor_sessions vs
    GROUP BY LOWER(BTRIM(vs.submitted_by_contact))
  ),
  vendor_submission_stats AS (
    SELECT
      contact_key,
      MIN(first_seen) AS first_submission_at
    FROM (
      SELECT LOWER(BTRIM(mis.submitted_by_contact)) AS contact_key, MIN(mis.created_at) AS first_seen
      FROM public.marketplace_item_submissions mis
      WHERE mis.source = 'vendor'
        AND COALESCE(BTRIM(mis.submitted_by_contact), '') <> ''
      GROUP BY LOWER(BTRIM(mis.submitted_by_contact))

      UNION ALL

      SELECT LOWER(BTRIM(rcs.submitted_by_contact)) AS contact_key, MIN(rcs.created_at) AS first_seen
      FROM public.relocation_catalog_submissions rcs
      WHERE rcs.source = 'partner_portal'
        AND COALESCE(BTRIM(rcs.submitted_by_contact), '') <> ''
      GROUP BY LOWER(BTRIM(rcs.submitted_by_contact))
    ) seen
    GROUP BY contact_key
  ),
  vendor_profile_hints AS (
    SELECT
      LOWER(BTRIM(phone_number)) AS contact_key,
      MAX(full_name) AS full_name
    FROM public.profiles
    WHERE COALESCE(BTRIM(phone_number), '') <> ''
    GROUP BY LOWER(BTRIM(phone_number))
  ),
  vendor_rows AS (
    SELECT
      'vendor'::TEXT AS subject_type,
      vc.contact_key AS subject_key,
      COALESCE(vph.full_name, 'Vendor') AS display_name,
      vc.contact_key AS contact,
      'vendor'::TEXT AS role_label,
      COALESCE(ctrl.is_active, TRUE) AS is_active,
      ctrl.status_note AS status_note,
      COALESCE(vss.active_sessions, 0) AS active_sessions,
      COALESCE(vss.total_sessions, 0) AS total_sessions,
      COALESCE(vss.total_time_seconds, 0) AS total_time_seconds,
      vss.last_accessed_at,
      vss.last_session_started_at,
      COALESCE(vss.first_session_at, vsub.first_submission_at) AS registered_at
    FROM vendor_contacts vc
    LEFT JOIN vendor_session_stats vss
      ON vss.contact_key = vc.contact_key
    LEFT JOIN vendor_submission_stats vsub
      ON vsub.contact_key = vc.contact_key
    LEFT JOIN vendor_profile_hints vph
      ON vph.contact_key = vc.contact_key
    LEFT JOIN public.identity_access_controls ctrl
      ON ctrl.subject_type = 'vendor'
     AND ctrl.subject_key = vc.contact_key
  )
  SELECT *
  FROM (
    SELECT * FROM user_rows
    UNION ALL
    SELECT * FROM vendor_rows
  ) identities
  ORDER BY identities.last_accessed_at DESC NULLS LAST, identities.registered_at DESC NULLS LAST
  LIMIT COALESCE(NULLIF(p_limit, 0), 500);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_identity_access_overview(TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_get_identity_access_overview(TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_identity_access(
  p_session_token TEXT,
  p_subject_type TEXT,
  p_subject_key TEXT,
  p_is_active BOOLEAN,
  p_status_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_session RECORD;
  v_subject_type TEXT;
  v_subject_key TEXT;
BEGIN
  SELECT *
  INTO v_admin_session
  FROM public.validate_admin_session(p_session_token)
  LIMIT 1;

  IF v_admin_session IS NULL THEN
    RAISE EXCEPTION 'Invalid admin session';
  END IF;

  v_subject_type := LOWER(BTRIM(p_subject_type));
  IF v_subject_type NOT IN ('user', 'vendor') THEN
    RAISE EXCEPTION 'Invalid subject type';
  END IF;

  v_subject_key := BTRIM(COALESCE(p_subject_key, ''));
  IF v_subject_key = '' THEN
    RAISE EXCEPTION 'Subject key is required';
  END IF;

  IF v_subject_type = 'vendor' THEN
    v_subject_key := LOWER(v_subject_key);
  END IF;

  INSERT INTO public.identity_access_controls (
    subject_type,
    subject_key,
    is_active,
    status_note,
    updated_by
  )
  VALUES (
    v_subject_type,
    v_subject_key,
    COALESCE(p_is_active, TRUE),
    NULLIF(BTRIM(COALESCE(p_status_note, '')), ''),
    v_admin_session.admin_user_id
  )
  ON CONFLICT (subject_type, subject_key)
  DO UPDATE
  SET
    is_active = EXCLUDED.is_active,
    status_note = EXCLUDED.status_note,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  IF v_subject_type = 'vendor' AND COALESCE(p_is_active, TRUE) = FALSE THEN
    UPDATE public.vendor_sessions
    SET revoked_at = now()
    WHERE LOWER(BTRIM(submitted_by_contact)) = v_subject_key
      AND revoked_at IS NULL
      AND expires_at > now();
  END IF;

  BEGIN
    INSERT INTO public.admin_activity_log (
      admin_user_id,
      activity_type,
      description,
      metadata
    )
    VALUES (
      v_admin_session.admin_user_id,
      'property_submission_approved',
      CASE
        WHEN COALESCE(p_is_active, TRUE) THEN 'Activated identity access'
        ELSE 'Disabled identity access'
      END,
      jsonb_build_object(
        'subject_type', v_subject_type,
        'subject_key', v_subject_key,
        'is_active', COALESCE(p_is_active, TRUE),
        'status_note', NULLIF(BTRIM(COALESCE(p_status_note, '')), ''),
        'identity_access_update', TRUE
      )
    );
  EXCEPTION
    WHEN others THEN
      NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_identity_access(TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_set_identity_access(TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

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

  IF EXISTS (
    SELECT 1
    FROM public.identity_access_controls ctrl
    WHERE ctrl.subject_type = 'vendor'
      AND ctrl.subject_key = v_contact
      AND ctrl.is_active = FALSE
  ) THEN
    RAISE EXCEPTION 'Vendor account is disabled';
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
    AND NOT EXISTS (
      SELECT 1
      FROM public.identity_access_controls ctrl
      WHERE ctrl.subject_type = 'vendor'
        AND ctrl.subject_key = LOWER(BTRIM(vs.submitted_by_contact))
        AND ctrl.is_active = FALSE
    )
  LIMIT 1;

  UPDATE public.vendor_sessions
  SET last_seen_at = now()
  WHERE public.vendor_sessions.session_token = p_session_token
    AND public.vendor_sessions.revoked_at IS NULL
    AND public.vendor_sessions.expires_at > now()
    AND NOT EXISTS (
      SELECT 1
      FROM public.identity_access_controls ctrl
      WHERE ctrl.subject_type = 'vendor'
        AND ctrl.subject_key = LOWER(BTRIM(public.vendor_sessions.submitted_by_contact))
        AND ctrl.is_active = FALSE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_vendor_session(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_vendor_session(TEXT) TO authenticated;
