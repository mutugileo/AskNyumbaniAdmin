-- Migration: Fix ambiguous column in validate_vendor_session()
-- Date: 2026-02-11

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
