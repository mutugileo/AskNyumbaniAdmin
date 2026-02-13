-- Migration: Marketplace offers + negotiation workflow
-- Date: 2026-02-11
-- Purpose:
--   - Store buyer offers for marketplace listings
--   - Enable vendor/admin negotiation replies
--   - Provide secure RPCs for app, vendor, admin

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Offers tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.marketplace_item_submissions(id) ON DELETE CASCADE,
  domain TEXT NOT NULL CHECK (domain IN ('resale', 'decor')),
  offer_amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'countered', 'accepted', 'declined', 'withdrawn')),

  buyer_user_id UUID,
  buyer_name TEXT,
  buyer_contact TEXT,

  vendor_contact TEXT,
  vendor_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_offers_listing
  ON public.marketplace_offers(listing_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_offers_buyer
  ON public.marketplace_offers(buyer_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_offers_vendor
  ON public.marketplace_offers(vendor_contact, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_offers_status
  ON public.marketplace_offers(status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_marketplace_offer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketplace_offers_updated_at ON public.marketplace_offers;
CREATE TRIGGER trg_marketplace_offers_updated_at
BEFORE UPDATE ON public.marketplace_offers
FOR EACH ROW
EXECUTE FUNCTION public.set_marketplace_offer_updated_at();

CREATE TABLE IF NOT EXISTS public.marketplace_offer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.marketplace_offers(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('buyer', 'vendor', 'admin', 'system')),
  message TEXT,
  offer_amount NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_offer_messages_offer
  ON public.marketplace_offer_messages(offer_id, created_at ASC);

REVOKE ALL ON TABLE public.marketplace_offers FROM anon;
REVOKE ALL ON TABLE public.marketplace_offers FROM authenticated;
REVOKE ALL ON TABLE public.marketplace_offer_messages FROM anon;
REVOKE ALL ON TABLE public.marketplace_offer_messages FROM authenticated;

-- ---------------------------------------------------------------------------
-- Buyer RPCs (app)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buyer_create_marketplace_offer(
  p_listing_id UUID,
  p_offer_amount NUMERIC,
  p_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.marketplace_item_submissions%ROWTYPE;
  v_offer_id UUID;
  v_buyer_id UUID;
  v_buyer_name TEXT;
  v_buyer_contact TEXT;
BEGIN
  v_buyer_id := auth.uid();
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit offers';
  END IF;

  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'Listing id is required';
  END IF;

  IF p_offer_amount IS NULL OR p_offer_amount <= 0 THEN
    RAISE EXCEPTION 'Offer amount must be greater than zero';
  END IF;

  SELECT *
  INTO v_listing
  FROM public.marketplace_item_submissions
  WHERE id = p_listing_id;

  IF v_listing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  IF v_listing.status <> 'approved' OR v_listing.published <> TRUE THEN
    RAISE EXCEPTION 'Listing is not available for offers';
  END IF;

  SELECT
    NULLIF(full_name, ''),
    NULLIF(email, '')
  INTO v_buyer_name, v_buyer_contact
  FROM public.profiles
  WHERE id = v_buyer_id;

  INSERT INTO public.marketplace_offers (
    listing_id,
    domain,
    offer_amount,
    currency,
    status,
    buyer_user_id,
    buyer_name,
    buyer_contact,
    vendor_contact,
    vendor_name
  )
  VALUES (
    v_listing.id,
    v_listing.domain,
    p_offer_amount,
    v_listing.currency,
    'pending',
    v_buyer_id,
    v_buyer_name,
    v_buyer_contact,
    v_listing.submitted_by_contact,
    v_listing.submitted_by_name
  )
  RETURNING id INTO v_offer_id;

  INSERT INTO public.marketplace_offer_messages (
    offer_id,
    sender_role,
    message,
    offer_amount
  )
  VALUES (
    v_offer_id,
    'buyer',
    NULLIF(BTRIM(p_message), ''),
    p_offer_amount
  );

  RETURN v_offer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buyer_create_marketplace_offer(UUID, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.buyer_create_marketplace_offer(UUID, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.buyer_get_marketplace_offers()
RETURNS TABLE (
  offer_id UUID,
  listing_id UUID,
  domain TEXT,
  item_type TEXT,
  item_title TEXT,
  location TEXT,
  asking_price NUMERIC,
  currency TEXT,
  offer_amount NUMERIC,
  status TEXT,
  vendor_name TEXT,
  vendor_contact TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  image_urls JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id UUID;
BEGIN
  v_buyer_id := auth.uid();
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to view offers';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.listing_id,
    o.domain,
    ms.item_type,
    ms.title,
    ms.location,
    ms.price,
    o.currency,
    o.offer_amount,
    o.status,
    o.vendor_name,
    o.vendor_contact,
    o.created_at,
    o.updated_at,
    ms.image_urls
  FROM public.marketplace_offers o
  JOIN public.marketplace_item_submissions ms ON ms.id = o.listing_id
  WHERE o.buyer_user_id = v_buyer_id
  ORDER BY o.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buyer_get_marketplace_offers() TO anon;
GRANT EXECUTE ON FUNCTION public.buyer_get_marketplace_offers() TO authenticated;

CREATE OR REPLACE FUNCTION public.buyer_get_marketplace_offer_messages(
  p_offer_id UUID
)
RETURNS TABLE (
  id UUID,
  sender_role TEXT,
  message TEXT,
  offer_amount NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id UUID;
  v_offer public.marketplace_offers%ROWTYPE;
BEGIN
  v_buyer_id := auth.uid();
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to view offer messages';
  END IF;

  SELECT *
  INTO v_offer
  FROM public.marketplace_offers
  WHERE id = p_offer_id
    AND buyer_user_id = v_buyer_id;

  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.sender_role,
    m.message,
    m.offer_amount,
    m.created_at
  FROM public.marketplace_offer_messages m
  WHERE m.offer_id = p_offer_id
  ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buyer_get_marketplace_offer_messages(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.buyer_get_marketplace_offer_messages(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.buyer_send_marketplace_offer_message(
  p_offer_id UUID,
  p_message TEXT DEFAULT NULL,
  p_offer_amount NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id UUID;
  v_offer public.marketplace_offers%ROWTYPE;
  v_message_id UUID;
  v_next_status TEXT;
BEGIN
  v_buyer_id := auth.uid();
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to respond';
  END IF;

  SELECT *
  INTO v_offer
  FROM public.marketplace_offers
  WHERE id = p_offer_id
    AND buyer_user_id = v_buyer_id;

  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  IF (p_message IS NULL OR BTRIM(p_message) = '') AND p_offer_amount IS NULL THEN
    RAISE EXCEPTION 'Message or offer amount is required';
  END IF;

  IF p_offer_amount IS NOT NULL THEN
    v_next_status := 'countered';
  ELSE
    v_next_status := v_offer.status;
  END IF;

  UPDATE public.marketplace_offers
  SET offer_amount = COALESCE(p_offer_amount, offer_amount),
      status = v_next_status,
      updated_at = now()
  WHERE id = p_offer_id;

  INSERT INTO public.marketplace_offer_messages (
    offer_id,
    sender_role,
    message,
    offer_amount
  )
  VALUES (
    p_offer_id,
    'buyer',
    NULLIF(BTRIM(p_message), ''),
    p_offer_amount
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buyer_send_marketplace_offer_message(UUID, TEXT, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION public.buyer_send_marketplace_offer_message(UUID, TEXT, NUMERIC) TO authenticated;

-- ---------------------------------------------------------------------------
-- Vendor RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_get_marketplace_offers(
  p_session_token TEXT,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  offer_id UUID,
  listing_id UUID,
  domain TEXT,
  item_type TEXT,
  item_title TEXT,
  location TEXT,
  asking_price NUMERIC,
  currency TEXT,
  offer_amount NUMERIC,
  status TEXT,
  buyer_user_id UUID,
  buyer_name TEXT,
  buyer_contact TEXT,
  vendor_contact TEXT,
  vendor_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  image_urls JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT *
  INTO v_session
  FROM public.validate_vendor_session(p_session_token);

  IF v_session.session_token IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired vendor session';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.listing_id,
    o.domain,
    ms.item_type,
    ms.title,
    ms.location,
    ms.price,
    o.currency,
    o.offer_amount,
    o.status,
    o.buyer_user_id,
    o.buyer_name,
    o.buyer_contact,
    o.vendor_contact,
    o.vendor_name,
    o.created_at,
    o.updated_at,
    ms.image_urls
  FROM public.marketplace_offers o
  JOIN public.marketplace_item_submissions ms ON ms.id = o.listing_id
  WHERE LOWER(BTRIM(o.vendor_contact)) = LOWER(BTRIM(v_session.submitted_by_contact))
    AND (p_status IS NULL OR o.status = p_status)
  ORDER BY o.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_get_marketplace_offers(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_get_marketplace_offers(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_get_marketplace_offer_messages(
  p_session_token TEXT,
  p_offer_id UUID
)
RETURNS TABLE (
  id UUID,
  sender_role TEXT,
  message TEXT,
  offer_amount NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_offer public.marketplace_offers%ROWTYPE;
BEGIN
  SELECT *
  INTO v_session
  FROM public.validate_vendor_session(p_session_token);

  IF v_session.session_token IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired vendor session';
  END IF;

  SELECT *
  INTO v_offer
  FROM public.marketplace_offers
  WHERE id = p_offer_id
    AND LOWER(BTRIM(vendor_contact)) = LOWER(BTRIM(v_session.submitted_by_contact));

  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.sender_role,
    m.message,
    m.offer_amount,
    m.created_at
  FROM public.marketplace_offer_messages m
  WHERE m.offer_id = p_offer_id
  ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_get_marketplace_offer_messages(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_get_marketplace_offer_messages(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.vendor_reply_marketplace_offer(
  p_session_token TEXT,
  p_offer_id UUID,
  p_message TEXT DEFAULT NULL,
  p_offer_amount NUMERIC DEFAULT NULL,
  p_next_status TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_offer public.marketplace_offers%ROWTYPE;
  v_message_id UUID;
  v_status TEXT;
  v_message TEXT;
BEGIN
  SELECT *
  INTO v_session
  FROM public.validate_vendor_session(p_session_token);

  IF v_session.session_token IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired vendor session';
  END IF;

  SELECT *
  INTO v_offer
  FROM public.marketplace_offers
  WHERE id = p_offer_id
    AND LOWER(BTRIM(vendor_contact)) = LOWER(BTRIM(v_session.submitted_by_contact));

  IF v_offer.id IS NULL THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  IF (p_message IS NULL OR BTRIM(p_message) = '') AND p_offer_amount IS NULL AND p_next_status IS NULL THEN
    RAISE EXCEPTION 'Reply message, counter amount, or status is required';
  END IF;

  IF p_next_status IS NOT NULL AND p_next_status NOT IN ('pending', 'countered', 'accepted', 'declined', 'withdrawn') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  v_status := COALESCE(
    p_next_status,
    CASE WHEN p_offer_amount IS NOT NULL THEN 'countered' ELSE v_offer.status END
  );

  UPDATE public.marketplace_offers
  SET offer_amount = COALESCE(p_offer_amount, offer_amount),
      status = v_status,
      updated_at = now()
  WHERE id = p_offer_id;

  v_message := NULLIF(BTRIM(p_message), '');
  IF v_message IS NULL AND p_offer_amount IS NULL AND p_next_status IS NOT NULL THEN
    v_message := 'Status updated to ' || p_next_status;
  END IF;

  INSERT INTO public.marketplace_offer_messages (
    offer_id,
    sender_role,
    message,
    offer_amount
  )
  VALUES (
    p_offer_id,
    'vendor',
    v_message,
    p_offer_amount
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_reply_marketplace_offer(TEXT, UUID, TEXT, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.vendor_reply_marketplace_offer(TEXT, UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin RPCs (read-only by default)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_marketplace_offers(
  p_session_token TEXT,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  offer_id UUID,
  listing_id UUID,
  domain TEXT,
  item_type TEXT,
  item_title TEXT,
  location TEXT,
  asking_price NUMERIC,
  currency TEXT,
  offer_amount NUMERIC,
  status TEXT,
  buyer_user_id UUID,
  buyer_name TEXT,
  buyer_contact TEXT,
  vendor_contact TEXT,
  vendor_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  image_urls JSONB
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
  FROM public.validate_admin_session(p_session_token);

  IF v_admin_session IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired admin session';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.listing_id,
    o.domain,
    ms.item_type,
    ms.title,
    ms.location,
    ms.price,
    o.currency,
    o.offer_amount,
    o.status,
    o.buyer_user_id,
    o.buyer_name,
    o.buyer_contact,
    o.vendor_contact,
    o.vendor_name,
    o.created_at,
    o.updated_at,
    ms.image_urls
  FROM public.marketplace_offers o
  JOIN public.marketplace_item_submissions ms ON ms.id = o.listing_id
  WHERE (p_status IS NULL OR o.status = p_status)
  ORDER BY o.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_marketplace_offers(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_get_marketplace_offers(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_marketplace_offer_messages(
  p_session_token TEXT,
  p_offer_id UUID
)
RETURNS TABLE (
  id UUID,
  sender_role TEXT,
  message TEXT,
  offer_amount NUMERIC,
  created_at TIMESTAMPTZ
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
  FROM public.validate_admin_session(p_session_token);

  IF v_admin_session IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired admin session';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.sender_role,
    m.message,
    m.offer_amount,
    m.created_at
  FROM public.marketplace_offer_messages m
  WHERE m.offer_id = p_offer_id
  ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_marketplace_offer_messages(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_get_marketplace_offer_messages(TEXT, UUID) TO authenticated;

COMMENT ON TABLE public.marketplace_offers IS
'Buyer offers for approved marketplace listings. Used for negotiation between buyers and vendors.';

COMMENT ON TABLE public.marketplace_offer_messages IS
'Conversation messages for marketplace offers.';
