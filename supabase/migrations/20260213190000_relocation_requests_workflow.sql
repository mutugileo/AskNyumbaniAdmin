-- Migration: Relocation request booking + vendor status workflow
-- Date: 2026-02-13
-- Purpose:
--   1) Persist relocation requests submitted from mobile checkout
--   2) Expose buyer tracking feed via RPC
--   3) Let vendors update assigned request statuses via vendor session

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.normalize_relocation_key(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(lower(btrim(COALESCE(p_value, ''))), '[^a-z0-9]+', '', 'g'),
    ''
  );
$$;

CREATE TABLE IF NOT EXISTS public.relocation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL,

  service_type TEXT NOT NULL,
  source_address TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  distance_km NUMERIC(10, 2) NOT NULL DEFAULT 0,

  source_floor INT NOT NULL DEFAULT 0,
  destination_floor INT NOT NULL DEFAULT 0,
  source_has_lift BOOLEAN NOT NULL DEFAULT TRUE,
  destination_has_lift BOOLEAN NOT NULL DEFAULT TRUE,
  parking_distance TEXT NOT NULL DEFAULT 'near',

  selected_truck_id TEXT,
  selected_addon_ids TEXT[] NOT NULL DEFAULT '{}',
  selected_mover_id TEXT,

  assigned_vendor_contact TEXT,
  assigned_mover_submission_id UUID,

  schedule_date TEXT NOT NULL,
  schedule_slot TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  notes TEXT,

  estimate_min INT,
  estimate_max INT,

  status TEXT NOT NULL DEFAULT 'under_review' CHECK (
    status IN (
      'under_review',
      'accepted',
      'rejected',
      'on_the_way',
      'loading',
      'in_transit',
      'delivered',
      'completed',
      'cancelled'
    )
  ),
  status_note TEXT,
  status_updated_by TEXT NOT NULL DEFAULT 'system',
  status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relocation_requests_requester
  ON public.relocation_requests(requester_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relocation_requests_vendor
  ON public.relocation_requests(assigned_vendor_contact, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relocation_requests_status
  ON public.relocation_requests(status, status_updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_relocation_request_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_relocation_requests_updated_at ON public.relocation_requests;
CREATE TRIGGER trg_relocation_requests_updated_at
BEFORE UPDATE ON public.relocation_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_relocation_request_updated_at();

REVOKE ALL ON TABLE public.relocation_requests FROM anon;
REVOKE ALL ON TABLE public.relocation_requests FROM authenticated;

CREATE OR REPLACE FUNCTION public.buyer_submit_relocation_request(
  p_service_type TEXT,
  p_source_address TEXT,
  p_destination_address TEXT,
  p_distance_km NUMERIC DEFAULT 0,
  p_source_floor INT DEFAULT 0,
  p_destination_floor INT DEFAULT 0,
  p_source_has_lift BOOLEAN DEFAULT TRUE,
  p_destination_has_lift BOOLEAN DEFAULT TRUE,
  p_parking_distance TEXT DEFAULT 'near',
  p_selected_truck_id TEXT DEFAULT NULL,
  p_selected_addon_ids TEXT[] DEFAULT NULL,
  p_selected_mover_id TEXT DEFAULT NULL,
  p_schedule_date TEXT DEFAULT '',
  p_schedule_slot TEXT DEFAULT 'morning',
  p_contact_name TEXT DEFAULT '',
  p_contact_phone TEXT DEFAULT '',
  p_notes TEXT DEFAULT NULL,
  p_estimate_min INT DEFAULT NULL,
  p_estimate_max INT DEFAULT NULL,
  p_request_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_request_id UUID;
  v_selected_mover_key TEXT;
  v_selected_truck_key TEXT;
  v_mover RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to submit relocation request';
  END IF;

  IF COALESCE(BTRIM(p_source_address), '') = '' OR COALESCE(BTRIM(p_destination_address), '') = '' THEN
    RAISE EXCEPTION 'Source and destination are required';
  END IF;

  IF COALESCE(BTRIM(p_schedule_date), '') = '' THEN
    RAISE EXCEPTION 'Schedule date is required';
  END IF;

  IF COALESCE(BTRIM(p_contact_name), '') = '' OR COALESCE(BTRIM(p_contact_phone), '') = '' THEN
    RAISE EXCEPTION 'Contact details are required';
  END IF;

  v_selected_mover_key := public.normalize_relocation_key(p_selected_mover_id);
  v_selected_truck_key := public.normalize_relocation_key(p_selected_truck_id);

  IF v_selected_mover_key IS NOT NULL THEN
    SELECT
      rcs.id,
      rcs.submitted_by_contact,
      rcs.title
    INTO v_mover
    FROM public.relocation_catalog_submissions rcs
    WHERE rcs.submission_type = 'mover_profile'
      AND rcs.status = 'approved'
      AND rcs.published = TRUE
      AND (
        public.normalize_relocation_key(rcs.payload ->> 'mover_id') = v_selected_mover_key
        OR public.normalize_relocation_key(rcs.payload ->> 'id') = v_selected_mover_key
        OR public.normalize_relocation_key(rcs.title) = v_selected_mover_key
      )
    ORDER BY rcs.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_mover.id IS NULL THEN
    SELECT
      rcs.id,
      rcs.submitted_by_contact,
      rcs.title
    INTO v_mover
    FROM public.relocation_catalog_submissions rcs
    WHERE rcs.submission_type = 'mover_profile'
      AND rcs.status = 'approved'
      AND rcs.published = TRUE
      AND (
        v_selected_truck_key IS NULL
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(rcs.payload -> 'supported_truck_ids', '[]'::jsonb)) truck(value)
          WHERE public.normalize_relocation_key(truck.value) = v_selected_truck_key
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(rcs.payload -> 'supported_vehicle_ids', '[]'::jsonb)) truck(value)
          WHERE public.normalize_relocation_key(truck.value) = v_selected_truck_key
        )
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(rcs.payload -> 'vehicle_types', '[]'::jsonb)) truck(value)
          WHERE public.normalize_relocation_key(truck.value) = v_selected_truck_key
        )
      )
    ORDER BY rcs.updated_at DESC
    LIMIT 1;
  END IF;

  INSERT INTO public.relocation_requests (
    requester_user_id,
    service_type,
    source_address,
    destination_address,
    distance_km,
    source_floor,
    destination_floor,
    source_has_lift,
    destination_has_lift,
    parking_distance,
    selected_truck_id,
    selected_addon_ids,
    selected_mover_id,
    assigned_vendor_contact,
    assigned_mover_submission_id,
    schedule_date,
    schedule_slot,
    contact_name,
    contact_phone,
    notes,
    estimate_min,
    estimate_max,
    status,
    status_note,
    status_updated_by,
    status_updated_at,
    request_payload
  )
  VALUES (
    v_user_id,
    COALESCE(NULLIF(BTRIM(p_service_type), ''), 'home'),
    BTRIM(p_source_address),
    BTRIM(p_destination_address),
    COALESCE(p_distance_km, 0),
    COALESCE(p_source_floor, 0),
    COALESCE(p_destination_floor, 0),
    COALESCE(p_source_has_lift, TRUE),
    COALESCE(p_destination_has_lift, TRUE),
    COALESCE(NULLIF(BTRIM(p_parking_distance), ''), 'near'),
    NULLIF(BTRIM(p_selected_truck_id), ''),
    COALESCE(p_selected_addon_ids, '{}'),
    NULLIF(BTRIM(p_selected_mover_id), ''),
    NULLIF(BTRIM(COALESCE(v_mover.submitted_by_contact, '')), ''),
    v_mover.id,
    BTRIM(p_schedule_date),
    COALESCE(NULLIF(BTRIM(p_schedule_slot), ''), 'morning'),
    BTRIM(p_contact_name),
    BTRIM(p_contact_phone),
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    p_estimate_min,
    p_estimate_max,
    'under_review',
    'Submitted. Waiting for vendor acceptance.',
    'buyer',
    now(),
    COALESCE(p_request_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buyer_submit_relocation_request(
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  INT,
  INT,
  BOOLEAN,
  BOOLEAN,
  TEXT,
  TEXT,
  TEXT[],
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  INT,
  INT,
  JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.buyer_get_relocation_requests(
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  request_id UUID,
  status TEXT,
  status_note TEXT,
  status_updated_at TIMESTAMPTZ,
  status_updated_by TEXT,
  service_type TEXT,
  source_address TEXT,
  destination_address TEXT,
  distance_km NUMERIC,
  source_floor INT,
  destination_floor INT,
  source_has_lift BOOLEAN,
  destination_has_lift BOOLEAN,
  parking_distance TEXT,
  selected_truck_id TEXT,
  selected_truck_label TEXT,
  selected_addon_ids TEXT[],
  selected_mover_id TEXT,
  selected_mover_name TEXT,
  schedule_date TEXT,
  schedule_slot TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  notes TEXT,
  estimate_min INT,
  estimate_max INT,
  assigned_vendor_contact TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to view relocation requests';
  END IF;

  RETURN QUERY
  SELECT
    rr.id AS request_id,
    rr.status,
    rr.status_note,
    rr.status_updated_at,
    rr.status_updated_by,
    rr.service_type,
    rr.source_address,
    rr.destination_address,
    rr.distance_km,
    rr.source_floor,
    rr.destination_floor,
    rr.source_has_lift,
    rr.destination_has_lift,
    rr.parking_distance,
    rr.selected_truck_id,
    COALESCE(NULLIF(BTRIM(truck.title), ''), rr.selected_truck_id) AS selected_truck_label,
    rr.selected_addon_ids,
    rr.selected_mover_id,
    COALESCE(NULLIF(BTRIM(mover.title), ''), rr.selected_mover_id) AS selected_mover_name,
    rr.schedule_date,
    rr.schedule_slot,
    rr.contact_name,
    rr.contact_phone,
    rr.notes,
    rr.estimate_min,
    rr.estimate_max,
    rr.assigned_vendor_contact,
    rr.created_at,
    rr.updated_at
  FROM public.relocation_requests rr
  LEFT JOIN public.relocation_catalog_submissions mover
    ON mover.id = rr.assigned_mover_submission_id
  LEFT JOIN public.relocation_catalog_submissions truck
    ON truck.submission_type = 'vehicle'
   AND truck.status = 'approved'
   AND truck.published = TRUE
   AND (
     public.normalize_relocation_key(truck.payload ->> 'truck_id') = public.normalize_relocation_key(rr.selected_truck_id)
     OR public.normalize_relocation_key(truck.payload ->> 'id') = public.normalize_relocation_key(rr.selected_truck_id)
     OR public.normalize_relocation_key(truck.title) = public.normalize_relocation_key(rr.selected_truck_id)
   )
  WHERE rr.requester_user_id = v_user_id
  ORDER BY rr.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 20), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buyer_get_relocation_requests(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_get_relocation_requests(
  p_session_token TEXT,
  p_limit INT DEFAULT 200
)
RETURNS TABLE (
  request_id UUID,
  status TEXT,
  status_note TEXT,
  service_type TEXT,
  source_address TEXT,
  destination_address TEXT,
  distance_km NUMERIC,
  selected_truck_id TEXT,
  selected_truck_label TEXT,
  selected_addon_ids TEXT[],
  selected_mover_id TEXT,
  selected_mover_name TEXT,
  schedule_date TEXT,
  schedule_slot TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  notes TEXT,
  estimate_min INT,
  estimate_max INT,
  status_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  request_payload JSONB
)
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
  SELECT
    rr.id AS request_id,
    rr.status,
    rr.status_note,
    rr.service_type,
    rr.source_address,
    rr.destination_address,
    rr.distance_km,
    rr.selected_truck_id,
    COALESCE(NULLIF(BTRIM(truck.title), ''), rr.selected_truck_id) AS selected_truck_label,
    rr.selected_addon_ids,
    rr.selected_mover_id,
    COALESCE(NULLIF(BTRIM(mover.title), ''), rr.selected_mover_id) AS selected_mover_name,
    rr.schedule_date,
    rr.schedule_slot,
    rr.contact_name,
    rr.contact_phone,
    rr.notes,
    rr.estimate_min,
    rr.estimate_max,
    rr.status_updated_at,
    rr.created_at,
    rr.updated_at,
    rr.request_payload
  FROM public.relocation_requests rr
  LEFT JOIN public.relocation_catalog_submissions mover
    ON mover.id = rr.assigned_mover_submission_id
  LEFT JOIN public.relocation_catalog_submissions truck
    ON truck.submission_type = 'vehicle'
   AND truck.status = 'approved'
   AND truck.published = TRUE
   AND (
     public.normalize_relocation_key(truck.payload ->> 'truck_id') = public.normalize_relocation_key(rr.selected_truck_id)
     OR public.normalize_relocation_key(truck.payload ->> 'id') = public.normalize_relocation_key(rr.selected_truck_id)
     OR public.normalize_relocation_key(truck.title) = public.normalize_relocation_key(rr.selected_truck_id)
   )
  WHERE
    public.normalize_relocation_key(rr.assigned_vendor_contact) = public.normalize_relocation_key(v_vendor.submitted_by_contact)
    OR (
      rr.assigned_vendor_contact IS NULL
      AND rr.status = 'under_review'
      AND EXISTS (
        SELECT 1
        FROM public.relocation_catalog_submissions own_mover
        WHERE own_mover.submission_type = 'mover_profile'
          AND own_mover.status = 'approved'
          AND own_mover.published = TRUE
          AND public.normalize_relocation_key(own_mover.submitted_by_contact) = public.normalize_relocation_key(v_vendor.submitted_by_contact)
          AND (
            public.normalize_relocation_key(own_mover.payload ->> 'mover_id') = public.normalize_relocation_key(rr.selected_mover_id)
            OR public.normalize_relocation_key(own_mover.payload ->> 'id') = public.normalize_relocation_key(rr.selected_mover_id)
            OR public.normalize_relocation_key(own_mover.title) = public.normalize_relocation_key(rr.selected_mover_id)
          )
      )
    )
  ORDER BY rr.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 200), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_get_relocation_requests(TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_get_relocation_requests(TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_update_relocation_request_status(
  p_session_token TEXT,
  p_request_id UUID,
  p_status TEXT,
  p_status_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor RECORD;
  v_request public.relocation_requests%ROWTYPE;
  v_next_status TEXT;
BEGIN
  SELECT *
  INTO v_vendor
  FROM public.validate_vendor_session(p_session_token)
  LIMIT 1;

  IF v_vendor IS NULL THEN
    RAISE EXCEPTION 'Invalid vendor session';
  END IF;

  v_next_status := lower(btrim(COALESCE(p_status, '')));
  IF v_next_status NOT IN ('accepted', 'rejected', 'on_the_way', 'loading', 'in_transit', 'delivered', 'completed') THEN
    RAISE EXCEPTION 'Invalid relocation status transition target';
  END IF;

  SELECT *
  INTO v_request
  FROM public.relocation_requests rr
  WHERE rr.id = p_request_id
    AND (
      public.normalize_relocation_key(rr.assigned_vendor_contact) = public.normalize_relocation_key(v_vendor.submitted_by_contact)
      OR (
        rr.assigned_vendor_contact IS NULL
        AND rr.status = 'under_review'
        AND (
          rr.selected_mover_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.relocation_catalog_submissions own_mover
            WHERE own_mover.submission_type = 'mover_profile'
              AND own_mover.status = 'approved'
              AND own_mover.published = TRUE
              AND public.normalize_relocation_key(own_mover.submitted_by_contact) = public.normalize_relocation_key(v_vendor.submitted_by_contact)
              AND (
                public.normalize_relocation_key(own_mover.payload ->> 'mover_id') = public.normalize_relocation_key(rr.selected_mover_id)
                OR public.normalize_relocation_key(own_mover.payload ->> 'id') = public.normalize_relocation_key(rr.selected_mover_id)
                OR public.normalize_relocation_key(own_mover.title) = public.normalize_relocation_key(rr.selected_mover_id)
              )
          )
        )
      )
    )
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Relocation request not found for this vendor';
  END IF;

  IF v_request.status = 'under_review' AND v_next_status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'From under_review, vendor can only accept or reject';
  END IF;
  IF v_request.status = 'accepted' AND v_next_status <> 'on_the_way' THEN
    RAISE EXCEPTION 'From accepted, next status must be on_the_way';
  END IF;
  IF v_request.status = 'on_the_way' AND v_next_status <> 'loading' THEN
    RAISE EXCEPTION 'From on_the_way, next status must be loading';
  END IF;
  IF v_request.status = 'loading' AND v_next_status <> 'in_transit' THEN
    RAISE EXCEPTION 'From loading, next status must be in_transit';
  END IF;
  IF v_request.status = 'in_transit' AND v_next_status <> 'delivered' THEN
    RAISE EXCEPTION 'From in_transit, next status must be delivered';
  END IF;
  IF v_request.status = 'delivered' AND v_next_status <> 'completed' THEN
    RAISE EXCEPTION 'From delivered, next status must be completed';
  END IF;
  IF v_request.status IN ('rejected', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Terminal relocation status cannot be changed';
  END IF;

  UPDATE public.relocation_requests
  SET
    status = v_next_status,
    status_note = NULLIF(BTRIM(COALESCE(p_status_note, '')), ''),
    status_updated_by = 'vendor',
    status_updated_at = now(),
    assigned_vendor_contact = COALESCE(
      NULLIF(BTRIM(assigned_vendor_contact), ''),
      v_vendor.submitted_by_contact
    ),
    updated_at = now()
  WHERE id = p_request_id;

  PERFORM public.log_vendor_activity(
    v_vendor.submitted_by_contact,
    'relocation_request_status_updated',
    'Vendor updated relocation request status',
    jsonb_build_object(
      'request_id', p_request_id,
      'status', v_next_status,
      'status_note', NULLIF(BTRIM(COALESCE(p_status_note, '')), '')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_update_relocation_request_status(TEXT, UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_update_relocation_request_status(TEXT, UUID, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.relocation_requests IS
'Persisted relocation move requests submitted from the mobile app and progressed by assigned vendors.';

COMMENT ON FUNCTION public.buyer_submit_relocation_request(
  TEXT,
  TEXT,
  TEXT,
  NUMERIC,
  INT,
  INT,
  BOOLEAN,
  BOOLEAN,
  TEXT,
  TEXT,
  TEXT[],
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  INT,
  INT,
  JSONB
) IS
'Creates a relocation request for the authenticated buyer and sets initial status to under_review.';

COMMENT ON FUNCTION public.buyer_get_relocation_requests(INT) IS
'Returns relocation requests for the authenticated buyer, newest first.';

COMMENT ON FUNCTION public.vendor_get_relocation_requests(TEXT, INT) IS
'Returns relocation requests assigned (or claimable by selected mover) for a validated vendor session.';

COMMENT ON FUNCTION public.vendor_update_relocation_request_status(TEXT, UUID, TEXT, TEXT) IS
'Advances relocation request status in a strict vendor workflow.';
