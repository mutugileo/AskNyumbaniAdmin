-- Migration: Relocation catalog moderation workflow
-- Date: 2026-02-09
-- Purpose:
--   1) Store user/partner/admin relocation submissions
--   2) Approve/reject before publishing to app surfaces
--   3) Expose a published-only view for mobile consumption

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.relocation_catalog_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  submission_type TEXT NOT NULL CHECK (
    submission_type IN (
      'mover_profile',
      'vehicle',
      'service_type',
      'inventory_template',
      'addon',
      'coverage_zone',
      'pricing_rule'
    )
  ),

  title TEXT NOT NULL,
  submitted_by_name TEXT NOT NULL,
  submitted_by_contact TEXT NOT NULL,
  submitted_by_user_id UUID,
  source TEXT NOT NULL DEFAULT 'mobile_user' CHECK (source IN ('admin', 'mobile_user', 'partner_portal')),

  location TEXT NOT NULL,
  payload_summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,

  reviewed_by_user_id UUID,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,

  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relocation_submissions_status
  ON public.relocation_catalog_submissions(status);

CREATE INDEX IF NOT EXISTS idx_relocation_submissions_type
  ON public.relocation_catalog_submissions(submission_type);

CREATE INDEX IF NOT EXISTS idx_relocation_submissions_created_at
  ON public.relocation_catalog_submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relocation_submissions_published
  ON public.relocation_catalog_submissions(published, status);

CREATE OR REPLACE FUNCTION public.set_relocation_submission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_relocation_submissions_updated_at ON public.relocation_catalog_submissions;
CREATE TRIGGER trg_relocation_submissions_updated_at
BEFORE UPDATE ON public.relocation_catalog_submissions
FOR EACH ROW
EXECUTE FUNCTION public.set_relocation_submission_updated_at();

CREATE OR REPLACE VIEW public.relocation_catalog_published AS
SELECT
  id,
  submission_type,
  title,
  location,
  payload_summary,
  payload,
  notes,
  published_at,
  created_at,
  updated_at
FROM public.relocation_catalog_submissions
WHERE status = 'approved'
  AND published = TRUE;

GRANT SELECT ON public.relocation_catalog_published TO anon;
GRANT SELECT ON public.relocation_catalog_published TO authenticated;

COMMENT ON TABLE public.relocation_catalog_submissions IS
'Moderation queue for relocation-related catalog content submitted by users, partners, or admins.';

COMMENT ON VIEW public.relocation_catalog_published IS
'Published relocation catalog records approved by admin and safe for app display.';
