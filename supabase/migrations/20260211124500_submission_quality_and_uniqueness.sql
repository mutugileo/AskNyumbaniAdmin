-- Guardrails: enforce relocation publish quality and prevent duplicate submissions.

CREATE OR REPLACE FUNCTION public.normalize_relocation_truck_id(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := regexp_replace(lower(COALESCE(BTRIM(p_value), '')), '[^a-z0-9]+', '-', 'g');

  IF v_normalized = '' THEN
    RETURN NULL;
  END IF;

  IF v_normalized IN ('pickup', 'van', '3-ton', '5-ton', '10-ton') THEN
    RETURN v_normalized;
  END IF;

  IF v_normalized = '3ton' THEN
    RETURN '3-ton';
  END IF;
  IF v_normalized = '5ton' THEN
    RETURN '5-ton';
  END IF;
  IF v_normalized = '10ton' THEN
    RETURN '10-ton';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_relocation_submission_for_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_payload JSONB;
  v_truck_id TEXT;
  v_invalid_supported_count INT;
BEGIN
  IF NEW.status = 'approved' OR NEW.published = TRUE THEN
    v_payload := COALESCE(NEW.payload, '{}'::jsonb);

    CASE NEW.submission_type
      WHEN 'mover_profile' THEN
        IF COALESCE(jsonb_typeof(v_payload -> 'supported_truck_ids'), '') <> 'array'
          OR jsonb_array_length(COALESCE(v_payload -> 'supported_truck_ids', '[]'::jsonb)) = 0 THEN
          RAISE EXCEPTION 'Mover profile must include at least one supported truck id';
        END IF;

        SELECT COUNT(*) INTO v_invalid_supported_count
        FROM jsonb_array_elements_text(v_payload -> 'supported_truck_ids') AS item(value)
        WHERE public.normalize_relocation_truck_id(item.value) IS NULL;

        IF v_invalid_supported_count > 0 THEN
          RAISE EXCEPTION 'Mover profile contains unsupported truck ids';
        END IF;

      WHEN 'vehicle' THEN
        v_truck_id := public.normalize_relocation_truck_id(v_payload ->> 'truck_id');
        IF v_truck_id IS NULL THEN
          RAISE EXCEPTION 'Vehicle requires a valid truck_id (pickup, van, 3-ton, 5-ton, 10-ton)';
        END IF;

        IF COALESCE(BTRIM(v_payload ->> 'base_fee'), '') = ''
          OR (v_payload ->> 'base_fee') !~ '^([0-9]+)([.][0-9]+)?$'
          OR (v_payload ->> 'base_fee')::NUMERIC < 0 THEN
          RAISE EXCEPTION 'Vehicle requires a valid non-negative base_fee';
        END IF;

      WHEN 'service_type' THEN
        IF COALESCE(BTRIM(v_payload ->> 'base_fee'), '') = ''
          OR (v_payload ->> 'base_fee') !~ '^([0-9]+)([.][0-9]+)?$'
          OR (v_payload ->> 'base_fee')::NUMERIC < 0 THEN
          RAISE EXCEPTION 'Service type requires a valid non-negative base_fee';
        END IF;

      WHEN 'coverage_zone' THEN
        IF COALESCE(BTRIM(v_payload ->> 'radius_km'), '') = ''
          OR (v_payload ->> 'radius_km') !~ '^([0-9]+)([.][0-9]+)?$'
          OR (v_payload ->> 'radius_km')::NUMERIC <= 0 THEN
          RAISE EXCEPTION 'Coverage zone requires a radius_km greater than 0';
        END IF;

      WHEN 'pricing_rule' THEN
        IF COALESCE(BTRIM(v_payload ->> 'multiplier'), '') = ''
          OR (v_payload ->> 'multiplier') !~ '^([0-9]+)([.][0-9]+)?$'
          OR (v_payload ->> 'multiplier')::NUMERIC <= 0 THEN
          RAISE EXCEPTION 'Pricing rule requires a multiplier greater than 0';
        END IF;
        IF COALESCE(BTRIM(v_payload ->> 'applies_to'), '') = '' THEN
          RAISE EXCEPTION 'Pricing rule requires applies_to';
        END IF;

      WHEN 'inventory_template' THEN
        IF COALESCE(jsonb_typeof(v_payload -> 'items'), '') <> 'array'
          OR jsonb_array_length(COALESCE(v_payload -> 'items', '[]'::jsonb)) = 0 THEN
          RAISE EXCEPTION 'Inventory template requires at least one item';
        END IF;

      WHEN 'addon' THEN
        IF COALESCE(BTRIM(v_payload ->> 'price'), '') = ''
          OR (v_payload ->> 'price') !~ '^([0-9]+)([.][0-9]+)?$'
          OR (v_payload ->> 'price')::NUMERIC < 0 THEN
          RAISE EXCEPTION 'Add-on requires a valid non-negative price';
        END IF;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_relocation_submission_for_publish ON public.relocation_catalog_submissions;
CREATE TRIGGER trg_validate_relocation_submission_for_publish
BEFORE INSERT OR UPDATE OF submission_type, payload, status, published
ON public.relocation_catalog_submissions
FOR EACH ROW
EXECUTE FUNCTION public.validate_relocation_submission_for_publish();

CREATE OR REPLACE FUNCTION public.prevent_duplicate_relocation_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_payload JSONB;
  v_existing_id UUID;
BEGIN
  IF NEW.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;

  v_payload := COALESCE(NEW.payload, '{}'::jsonb);

  SELECT rcs.id INTO v_existing_id
  FROM public.relocation_catalog_submissions rcs
  WHERE rcs.id <> NEW.id
    AND rcs.status IN ('pending', 'approved')
    AND rcs.submission_type = NEW.submission_type
    AND LOWER(BTRIM(rcs.submitted_by_contact)) = LOWER(BTRIM(NEW.submitted_by_contact))
    AND LOWER(BTRIM(rcs.title)) = LOWER(BTRIM(NEW.title))
    AND LOWER(BTRIM(rcs.location)) = LOWER(BTRIM(NEW.location))
    AND COALESCE(rcs.payload, '{}'::jsonb) IS NOT DISTINCT FROM v_payload
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate relocation submission detected (existing id: %)', v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_relocation_submissions ON public.relocation_catalog_submissions;
CREATE TRIGGER trg_prevent_duplicate_relocation_submissions
BEFORE INSERT OR UPDATE
ON public.relocation_catalog_submissions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_relocation_submission();

CREATE OR REPLACE FUNCTION public.prevent_duplicate_marketplace_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_payload JSONB;
  v_images JSONB;
  v_existing_id UUID;
BEGIN
  IF NEW.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;

  v_payload := COALESCE(NEW.payload, '{}'::jsonb);
  v_images := COALESCE(NEW.image_urls, '[]'::jsonb);

  SELECT mis.id INTO v_existing_id
  FROM public.marketplace_item_submissions mis
  WHERE mis.id <> NEW.id
    AND mis.status IN ('pending', 'approved')
    AND mis.domain = NEW.domain
    AND mis.item_type = NEW.item_type
    AND LOWER(BTRIM(mis.submitted_by_contact)) = LOWER(BTRIM(NEW.submitted_by_contact))
    AND LOWER(BTRIM(mis.title)) = LOWER(BTRIM(NEW.title))
    AND LOWER(BTRIM(mis.location)) = LOWER(BTRIM(NEW.location))
    AND mis.price IS NOT DISTINCT FROM NEW.price
    AND LOWER(BTRIM(mis.currency)) = LOWER(BTRIM(NEW.currency))
    AND COALESCE(mis.payload, '{}'::jsonb) IS NOT DISTINCT FROM v_payload
    AND COALESCE(mis.image_urls, '[]'::jsonb) IS NOT DISTINCT FROM v_images
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate marketplace submission detected (existing id: %)', v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_marketplace_submissions ON public.marketplace_item_submissions;
CREATE TRIGGER trg_prevent_duplicate_marketplace_submissions
BEFORE INSERT OR UPDATE
ON public.marketplace_item_submissions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_marketplace_submission();

COMMENT ON FUNCTION public.validate_relocation_submission_for_publish IS
'Blocks approval/publish for relocation records with incomplete or invalid payloads.';

COMMENT ON FUNCTION public.prevent_duplicate_relocation_submission IS
'Prevents duplicate active relocation submissions for the same submitter/content.';

COMMENT ON FUNCTION public.prevent_duplicate_marketplace_submission IS
'Prevents duplicate active marketplace submissions for the same submitter/content.';
