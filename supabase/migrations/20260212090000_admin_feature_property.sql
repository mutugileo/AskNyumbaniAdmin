-- Migration: Admin toggle property featured flag
-- Date: 2026-02-12
-- Purpose: Allow admin to set/unset is_featured on properties via secure RPC.

CREATE OR REPLACE FUNCTION public.admin_set_property_featured(
  p_session_token TEXT,
  p_property_id UUID,
  p_is_featured BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_session RECORD;
  v_target public.properties%ROWTYPE;
BEGIN
  SELECT *
  INTO v_admin_session
  FROM public.validate_admin_session(p_session_token)
  LIMIT 1;

  IF v_admin_session IS NULL THEN
    RAISE EXCEPTION 'Invalid admin session';
  END IF;

  SELECT *
  INTO v_target
  FROM public.properties
  WHERE id = p_property_id
  LIMIT 1;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  UPDATE public.properties
  SET
    is_featured = COALESCE(p_is_featured, FALSE),
    updated_at = now()
  WHERE id = p_property_id;

  INSERT INTO public.admin_activity_log (
    admin_user_id,
    activity_type,
    description,
    metadata
  )
  VALUES (
    v_admin_session.admin_user_id,
    'property_featured_updated',
    CASE WHEN p_is_featured THEN 'Marked property as featured' ELSE 'Removed featured flag from property' END,
    jsonb_build_object(
      'property_id', p_property_id,
      'is_featured', COALESCE(p_is_featured, FALSE)
    )
  );

  RETURN p_property_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_property_featured(TEXT, UUID, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_set_property_featured(TEXT, UUID, BOOLEAN) TO authenticated;
