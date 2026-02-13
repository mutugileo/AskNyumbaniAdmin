-- Vendor property/land submissions + admin review workflow.
-- Mirrors existing vendor session secured RPC model used for relocation/decor/resale.

ALTER TABLE IF EXISTS public.properties
  ADD COLUMN IF NOT EXISTS land_details JSONB;

CREATE OR REPLACE FUNCTION public.resolve_vendor_profile_id(
  p_contact TEXT,
  p_submitted_by_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone_number,
    user_type,
    is_verified
  )
  VALUES (
    gen_random_uuid(),
    v_email,
    v_name,
    v_phone,
    'agent',
    FALSE
  )
  ON CONFLICT (email) DO UPDATE
  SET
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    phone_number = COALESCE(public.profiles.phone_number, EXCLUDED.phone_number)
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_vendor_profile_id(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_vendor_profile_id(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_submit_property_submission(
  p_session_token TEXT,
  p_title TEXT,
  p_description TEXT,
  p_submitted_by_name TEXT,
  p_property_type TEXT,
  p_deal_type TEXT,
  p_price NUMERIC,
  p_currency TEXT DEFAULT 'KES',
  p_price_period TEXT DEFAULT NULL,
  p_bedrooms INT DEFAULT 0,
  p_bathrooms INT DEFAULT 0,
  p_kitchen_areas INT DEFAULT 0,
  p_square_meters NUMERIC DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_region TEXT DEFAULT NULL,
  p_county TEXT DEFAULT NULL,
  p_country TEXT DEFAULT 'Kenya',
  p_postal_code TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_land_details JSONB DEFAULT NULL,
  p_images JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor RECORD;
  v_owner_id UUID;
  v_property_id UUID;
  v_property_type TEXT;
  v_deal_type TEXT;
  v_price_period TEXT;
  v_title TEXT;
  v_description TEXT;
  v_address TEXT;
  v_city TEXT;
  v_region TEXT;
  v_county TEXT;
  v_image JSONB;
  v_ord INT;
  v_image_url TEXT;
  v_thumbnail_url TEXT;
  v_caption TEXT;
BEGIN
  SELECT *
  INTO v_vendor
  FROM public.validate_vendor_session(p_session_token)
  LIMIT 1;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Invalid vendor session';
  END IF;

  v_property_type := LOWER(BTRIM(COALESCE(p_property_type, '')));
  IF v_property_type NOT IN ('house', 'apartment', 'land', 'commercial', 'townhouse', 'villa', 'studio') THEN
    RAISE EXCEPTION 'Invalid property_type';
  END IF;

  v_deal_type := LOWER(BTRIM(COALESCE(p_deal_type, '')));
  IF v_deal_type NOT IN ('sale', 'rent', 'lease') THEN
    RAISE EXCEPTION 'Invalid deal_type';
  END IF;

  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'Price must be greater than 0';
  END IF;

  v_title := NULLIF(BTRIM(COALESCE(p_title, '')), '');
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  v_description := NULLIF(BTRIM(COALESCE(p_description, '')), '');
  IF v_description IS NULL THEN
    RAISE EXCEPTION 'Description is required';
  END IF;

  v_address := NULLIF(BTRIM(COALESCE(p_address, '')), '');
  IF v_address IS NULL THEN
    RAISE EXCEPTION 'Address is required';
  END IF;

  v_city := NULLIF(BTRIM(COALESCE(p_city, '')), '');
  v_region := NULLIF(BTRIM(COALESCE(p_region, '')), '');
  v_county := NULLIF(BTRIM(COALESCE(p_county, '')), '');

  IF v_city IS NULL OR v_region IS NULL OR v_county IS NULL THEN
    RAISE EXCEPTION 'City, region, and county are required';
  END IF;

  v_price_period := NULLIF(LOWER(BTRIM(COALESCE(p_price_period, ''))), '');
  IF v_deal_type = 'sale' THEN
    v_price_period := NULL;
  ELSIF v_price_period IS NOT NULL AND v_price_period NOT IN ('day', 'week', 'month', 'year') THEN
    RAISE EXCEPTION 'Invalid price_period';
  END IF;

  IF COALESCE(jsonb_typeof(COALESCE(p_images, '[]'::jsonb)), 'null') <> 'array' THEN
    RAISE EXCEPTION 'Images payload must be an array';
  END IF;

  v_owner_id := public.resolve_vendor_profile_id(v_vendor.submitted_by_contact, p_submitted_by_name);

  INSERT INTO public.properties (
    owner_id,
    title,
    description,
    property_type,
    deal_type,
    price,
    currency,
    price_period,
    bedrooms,
    bathrooms,
    kitchen_areas,
    square_meters,
    address,
    city,
    region,
    county,
    country,
    postal_code,
    latitude,
    longitude,
    status,
    land_details
  )
  VALUES (
    v_owner_id,
    v_title,
    v_description,
    v_property_type,
    v_deal_type,
    p_price,
    COALESCE(NULLIF(BTRIM(p_currency), ''), 'KES'),
    v_price_period,
    GREATEST(COALESCE(p_bedrooms, 0), 0),
    GREATEST(COALESCE(p_bathrooms, 0), 0),
    GREATEST(COALESCE(p_kitchen_areas, 0), 0),
    p_square_meters,
    v_address,
    v_city,
    v_region,
    v_county,
    COALESCE(NULLIF(BTRIM(p_country), ''), 'Kenya'),
    NULLIF(BTRIM(p_postal_code), ''),
    p_latitude,
    p_longitude,
    'pending',
    CASE WHEN v_property_type = 'land' THEN COALESCE(p_land_details, '{}'::jsonb) ELSE NULL END
  )
  RETURNING id INTO v_property_id;

  FOR v_image, v_ord IN
    SELECT img.value, img.ordinality::INT
    FROM jsonb_array_elements(COALESCE(p_images, '[]'::jsonb)) WITH ORDINALITY AS img(value, ordinality)
  LOOP
    IF jsonb_typeof(v_image) = 'string' THEN
      v_image_url := NULLIF(BTRIM(v_image #>> '{}'), '');
      v_thumbnail_url := NULL;
      v_caption := NULL;
    ELSE
      v_image_url := NULLIF(BTRIM(COALESCE(v_image ->> 'image_url', v_image ->> 'url', '')), '');
      v_thumbnail_url := NULLIF(BTRIM(COALESCE(v_image ->> 'thumbnail_url', '')), '');
      v_caption := NULLIF(BTRIM(COALESCE(v_image ->> 'caption', '')), '');
    END IF;

    IF v_image_url IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.property_images (
      property_id,
      image_url,
      thumbnail_url,
      caption,
      is_primary,
      display_order,
      admin_approved
    )
    VALUES (
      v_property_id,
      v_image_url,
      v_thumbnail_url,
      v_caption,
      v_ord = 1,
      v_ord - 1,
      NULL
    );
  END LOOP;

  PERFORM public.log_vendor_activity(
    v_vendor.submitted_by_contact,
    'property_submission_created',
    'Vendor submitted property listing',
    jsonb_build_object(
      'property_id', v_property_id,
      'property_type', v_property_type,
      'deal_type', v_deal_type
    )
  );

  RETURN v_property_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_submit_property_submission(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  TEXT,
  TEXT,
  INT,
  INT,
  INT,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  JSONB,
  JSONB
) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_submit_property_submission(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  TEXT,
  TEXT,
  INT,
  INT,
  INT,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  JSONB,
  JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_get_property_submissions(
  p_session_token TEXT,
  p_limit INT DEFAULT 200
)
RETURNS SETOF public.properties
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
  SELECT p.*
  FROM public.properties p
  JOIN public.profiles pr ON pr.id = p.owner_id
  WHERE LOWER(COALESCE(pr.email, '')) = LOWER(BTRIM(v_vendor.submitted_by_contact))
     OR LOWER(COALESCE(pr.phone_number, '')) = LOWER(BTRIM(v_vendor.submitted_by_contact))
  ORDER BY p.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_get_property_submissions(TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_get_property_submissions(TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_property_submissions(
  p_session_token TEXT,
  p_status TEXT DEFAULT NULL,
  p_limit INT DEFAULT 200
)
RETURNS SETOF public.properties
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_session RECORD;
  v_status TEXT;
BEGIN
  SELECT *
  INTO v_admin_session
  FROM public.validate_admin_session(p_session_token)
  LIMIT 1;

  IF v_admin_session IS NULL THEN
    RAISE EXCEPTION 'Invalid admin session';
  END IF;

  v_status := NULLIF(LOWER(BTRIM(COALESCE(p_status, ''))), '');
  IF v_status IS NOT NULL AND v_status NOT IN ('pending', 'available', 'inactive', 'draft', 'sold', 'rented') THEN
    RAISE EXCEPTION 'Invalid status filter';
  END IF;

  RETURN QUERY
  SELECT p.*
  FROM public.properties p
  WHERE v_status IS NULL OR p.status = v_status
  ORDER BY p.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_property_submissions(TEXT, TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_get_property_submissions(TEXT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_property_submission(
  p_session_token TEXT,
  p_property_id UUID,
  p_status TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_session RECORD;
  v_target public.properties%ROWTYPE;
  v_next_status TEXT;
  v_reason TEXT;
  v_owner_contact TEXT;
BEGIN
  SELECT *
  INTO v_admin_session
  FROM public.validate_admin_session(p_session_token)
  LIMIT 1;

  IF v_admin_session IS NULL THEN
    RAISE EXCEPTION 'Invalid admin session';
  END IF;

  v_next_status := LOWER(BTRIM(COALESCE(p_status, '')));
  IF v_next_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Status must be approved or rejected';
  END IF;

  SELECT *
  INTO v_target
  FROM public.properties
  WHERE id = p_property_id
  LIMIT 1;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  v_reason := NULLIF(BTRIM(COALESCE(p_rejection_reason, '')), '');
  IF v_next_status = 'rejected' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  UPDATE public.properties
  SET
    status = CASE WHEN v_next_status = 'approved' THEN 'available' ELSE 'inactive' END,
    is_verified = CASE WHEN v_next_status = 'approved' THEN TRUE ELSE is_verified END,
    updated_at = now()
  WHERE id = p_property_id;

  IF v_next_status = 'approved' THEN
    UPDATE public.property_images
    SET
      admin_approved = TRUE,
      admin_reviewed_at = now(),
      admin_reviewed_by = v_admin_session.admin_user_id,
      admin_rejection_reason = NULL,
      admin_comment = NULL
    WHERE property_id = p_property_id
      AND admin_approved IS DISTINCT FROM TRUE;
  ELSE
    UPDATE public.property_images
    SET
      admin_approved = FALSE,
      admin_reviewed_at = now(),
      admin_reviewed_by = v_admin_session.admin_user_id,
      admin_rejection_reason = v_reason,
      admin_comment = v_reason
    WHERE property_id = p_property_id
      AND admin_approved IS NULL;
  END IF;

  SELECT COALESCE(NULLIF(LOWER(BTRIM(pr.email)), ''), LOWER(BTRIM(pr.phone_number)))
  INTO v_owner_contact
  FROM public.profiles pr
  WHERE pr.id = v_target.owner_id
  LIMIT 1;

  IF v_owner_contact IS NOT NULL THEN
    PERFORM public.log_vendor_activity(
      v_owner_contact,
      CASE WHEN v_next_status = 'approved' THEN 'property_submission_approved' ELSE 'property_submission_rejected' END,
      CASE WHEN v_next_status = 'approved'
        THEN 'Property submission approved by admin'
        ELSE 'Property submission rejected by admin'
      END,
      jsonb_build_object(
        'property_id', p_property_id,
        'status', v_next_status,
        'rejection_reason', v_reason
      )
    );
  END IF;

  INSERT INTO public.admin_activity_log (
    admin_user_id,
    activity_type,
    description,
    metadata
  )
  VALUES (
    v_admin_session.admin_user_id,
    CASE WHEN v_next_status = 'approved' THEN 'property_submission_approved' ELSE 'property_submission_rejected' END,
    CASE WHEN v_next_status = 'approved' THEN 'Approved property submission' ELSE 'Rejected property submission' END,
    jsonb_build_object(
      'propertyId', p_property_id,
      'propertyTitle', v_target.title,
      'status', v_next_status,
      'rejectionReason', v_reason
    )
  );

  RETURN p_property_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_property_submission(TEXT, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_review_property_submission(TEXT, UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.vendor_submit_property_submission(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  TEXT,
  TEXT,
  INT,
  INT,
  INT,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  JSONB,
  JSONB
) IS 'Creates a pending property listing for a vendor session and stores submitted images.';

COMMENT ON FUNCTION public.admin_review_property_submission(TEXT, UUID, TEXT, TEXT) IS
'Approves or rejects pending property submissions and synchronizes image moderation flags.';
