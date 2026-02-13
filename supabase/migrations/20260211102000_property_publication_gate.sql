-- Ensure newly created properties require admin approval before appearing publicly.

ALTER TABLE IF EXISTS public.properties
  ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_properties_status_created_at
  ON public.properties(status, created_at DESC);

CREATE OR REPLACE VIEW public.properties_published AS
SELECT
  p.*
FROM public.properties p
WHERE p.status = 'available';

GRANT SELECT ON public.properties_published TO anon;
GRANT SELECT ON public.properties_published TO authenticated;

COMMENT ON VIEW public.properties_published IS
  'Public property feed restricted to admin-approved (available) listings.';
