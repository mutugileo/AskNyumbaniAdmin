-- Fix vendor profile creation when profiles.id references public.users (custom auth table).

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
  v_user_id UUID;
  v_email TEXT;
  v_name TEXT;
  v_phone TEXT;
  v_has_users BOOLEAN;
  v_cols TEXT := '';
  v_vals TEXT := '';
  v_value TEXT;
  v_data JSONB;
  v_col RECORD;
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

  v_user_id := extensions.gen_random_uuid();

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  )
  INTO v_has_users;

  IF v_has_users THEN
    v_data := jsonb_build_object(
      'id', v_user_id,
      'email', v_email,
      'phone_number', v_phone,
      'phone', v_phone,
      'full_name', v_name,
      'user_type', 'agent',
      'is_verified', false,
      'is_active', true,
      'created_at', now(),
      'updated_at', now()
    );

    FOR v_col IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name IN (
          SELECT jsonb_object_keys(v_data)
        )
      ORDER BY ordinal_position
    LOOP
      v_value := NULLIF(BTRIM(COALESCE(v_data ->> v_col.column_name, '')), '');
      IF v_value IS NULL THEN
        CONTINUE;
      END IF;

      IF v_cols <> '' THEN
        v_cols := v_cols || ',';
        v_vals := v_vals || ',';
      END IF;

      v_cols := v_cols || quote_ident(v_col.column_name);
      IF v_col.data_type = 'uuid' THEN
        v_vals := v_vals || format('%L::uuid', v_value);
      ELSIF v_col.data_type LIKE 'timestamp%' THEN
        v_vals := v_vals || format('%L', v_value);
      ELSIF v_col.data_type = 'boolean' THEN
        v_vals := v_vals || CASE WHEN v_value = 'true' THEN 'TRUE' ELSE 'FALSE' END;
      ELSE
        v_vals := v_vals || format('%L', v_value);
      END IF;
    END LOOP;

    IF v_cols <> '' THEN
      EXECUTE 'INSERT INTO public.users (' || v_cols || ') VALUES (' || v_vals || ') ON CONFLICT DO NOTHING';
    END IF;
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
      v_user_id,
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
