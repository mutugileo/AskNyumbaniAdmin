-- Fix vendor property submissions on projects where pgcrypto lives in extensions schema.
-- Also harden profile resolution to avoid reliance on ON CONFLICT(email) existing.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.resolve_vendor_profile_id(
  p_contact TEXT,
  p_submitted_by_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_contact TEXT;
  v_profile_id UUID;
  v_email TEXT;
  v_name TEXT;
  v_phone TEXT;
BEGIN
  v_contact := LOWER(BTRIM(COALESCE(p_contact, '')));
  IF v_contact = '' THEN
    RAISE EXCEPTION 'Contact is required';
  END IF;

  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE LOWER(COALESCE(p.email, '')) = v_contact
     OR LOWER(COALESCE(p.phone_number, '')) = v_contact
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      full_name = COALESCE(NULLIF(full_name, ''), NULLIF(BTRIM(COALESCE(p_submitted_by_name, '')), '')),
      phone_number = COALESCE(phone_number, CASE WHEN POSITION('@' IN v_contact) > 1 THEN NULL ELSE v_contact END)
    WHERE id = v_profile_id;

    RETURN v_profile_id;
  END IF;

  v_name := NULLIF(BTRIM(COALESCE(p_submitted_by_name, '')), '');
  IF v_name IS NULL THEN
    v_name := 'Vendor';
  END IF;

  IF POSITION('@' IN v_contact) > 1 THEN
    v_email := v_contact;
    v_phone := NULL;
  ELSE
    v_email := 'vendor+' || regexp_replace(v_contact, '[^a-z0-9]+', '-', 'g') || '@vendors.asknyumbani.app';
    v_phone := v_contact;
  END IF;

  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      phone_number,
      user_type,
      is_verified
    )
    VALUES (
      extensions.gen_random_uuid(),
      v_email,
      v_name,
      v_phone,
      'agent',
      FALSE
    )
    RETURNING id INTO v_profile_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT p.id
      INTO v_profile_id
      FROM public.profiles p
      WHERE LOWER(COALESCE(p.email, '')) = LOWER(COALESCE(v_email, ''))
         OR LOWER(COALESCE(p.phone_number, '')) = LOWER(COALESCE(v_phone, ''))
      ORDER BY p.created_at ASC
      LIMIT 1;
  END;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve vendor profile';
  END IF;

  RETURN v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_vendor_profile_id(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_vendor_profile_id(TEXT, TEXT) TO authenticated;
