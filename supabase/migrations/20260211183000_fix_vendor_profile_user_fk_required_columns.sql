-- Harden vendor profile creation when profiles.id -> users.id FK exists.
-- Ensures a public.users row is created with all NOT NULL / no-default columns populated.

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
  v_expr TEXT;
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
    FOR v_col IN
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
      ORDER BY ordinal_position
    LOOP
      v_expr := NULL;

      CASE v_col.column_name
        WHEN 'id' THEN v_expr := format('%L::uuid', v_user_id::text);
        WHEN 'email' THEN v_expr := format('%L', v_email);
        WHEN 'full_name' THEN v_expr := format('%L', v_name);
        WHEN 'name' THEN v_expr := format('%L', v_name);
        WHEN 'phone_number' THEN v_expr := format('%L', v_phone);
        WHEN 'phone' THEN v_expr := format('%L', v_phone);
        WHEN 'created_at' THEN v_expr := 'now()';
        WHEN 'updated_at' THEN v_expr := 'now()';
        WHEN 'is_active' THEN v_expr := 'TRUE';
        WHEN 'is_verified' THEN v_expr := 'FALSE';
        WHEN 'role' THEN v_expr := format('%L', 'vendor');
        WHEN 'user_type' THEN v_expr := format('%L', 'agent');
      END CASE;

      IF v_expr IS NULL AND v_col.is_nullable = 'NO' AND v_col.column_default IS NULL THEN
        IF v_col.data_type = 'uuid' THEN
          v_expr := format('%L::uuid', v_user_id::text);
        ELSIF v_col.data_type IN ('text', 'character varying', 'character') THEN
          v_expr := format('%L', '');
        ELSIF v_col.data_type = 'boolean' THEN
          v_expr := 'FALSE';
        ELSIF v_col.data_type LIKE 'timestamp%' THEN
          v_expr := 'now()';
        ELSIF v_col.data_type IN ('integer', 'numeric', 'bigint', 'smallint', 'double precision', 'real') THEN
          v_expr := '0';
        ELSIF v_col.data_type IN ('json', 'jsonb') THEN
          v_expr := '''{}''::jsonb';
        ELSE
          v_expr := format('%L', '');
        END IF;
      END IF;

      IF v_expr IS NULL THEN
        CONTINUE;
      END IF;

      IF v_cols <> '' THEN
        v_cols := v_cols || ',';
        v_vals := v_vals || ',';
      END IF;

      v_cols := v_cols || quote_ident(v_col.column_name);
      v_vals := v_vals || v_expr;
    END LOOP;

    IF v_cols <> '' THEN
      BEGIN
        EXECUTE 'INSERT INTO public.users (' || v_cols || ') VALUES (' || v_vals || ') ON CONFLICT DO NOTHING';
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Unable to create vendor user: %', SQLERRM;
      END;
    END IF;

    -- Ensure a user row exists before profile insert.
    PERFORM 1 FROM public.users u WHERE u.id = v_user_id;
    IF NOT FOUND THEN
      -- Try to find an existing user by contact (email/phone)
      IF v_email IS NOT NULL THEN
        SELECT u.id INTO v_user_id FROM public.users u WHERE LOWER(COALESCE(u.email, '')) = LOWER(v_email) LIMIT 1;
      END IF;
      IF v_user_id IS NULL AND v_phone IS NOT NULL THEN
        SELECT u.id INTO v_user_id FROM public.users u WHERE LOWER(COALESCE(u.phone_number, '')) = LOWER(v_phone) LIMIT 1;
      END IF;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    v_user_id := extensions.gen_random_uuid();
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
