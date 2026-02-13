-- Add payload_summary to marketplace_item_published view for mobile queries.

CREATE OR REPLACE VIEW public.marketplace_item_published AS
SELECT
  id,
  domain,
  item_type,
  title,
  location,
  price,
  currency,
  COALESCE(
    NULLIF(payload ->> 'summary', ''),
    NULLIF(payload ->> 'payload_summary', ''),
    NULLIF(payload ->> 'use_hint', ''),
    NULLIF(description, ''),
    NULLIF(title, '')
  ) AS payload_summary,
  description,
  image_urls,
  payload,
  published_at,
  created_at,
  updated_at
FROM public.marketplace_item_submissions
WHERE status = 'approved'
  AND published = TRUE;

GRANT SELECT ON public.marketplace_item_published TO anon;
GRANT SELECT ON public.marketplace_item_published TO authenticated;

COMMENT ON VIEW public.marketplace_item_published IS
  'Published marketplace listings with a computed payload_summary for mobile consumption.';
