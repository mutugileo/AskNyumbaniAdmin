-- Migration: Fix vendor OTP RPCs when pgcrypto functions are not on public search_path
-- Date: 2026-02-11
-- Purpose:
--   1) Ensure pgcrypto is enabled in Supabase extensions schema
--   2) Recreate OTP RPCs with extensions-aware search_path
--   3) Use schema-qualified crypto functions to avoid "gen_salt does not exist"

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.vendor_request_otp(
  p_submitted_by_contact TEXT,
  p_debug BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
SET search_path = public, extensions
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
