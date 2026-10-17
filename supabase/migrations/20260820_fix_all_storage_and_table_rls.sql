-- ==============================================================================
-- Complete Master Migration: Fix All Storage & Table RLS in Supabase
-- Run this in your Supabase SQL Editor (1-Click Fix)
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- PART 1: FIX STORAGE BUCKET & storage.objects RLS POLICIES
-- -----------------------------------------------------------------------------

-- 1. Create 'transfers' bucket if not already present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('transfers', 'transfers', true, 26843545600, NULL) -- 25 GB limit
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 26843545600;

-- 2. Drop old conflicting policies on storage.objects
DROP POLICY IF EXISTS "public_storage_insert_transfers" ON storage.objects;
DROP POLICY IF EXISTS "public_storage_select_transfers" ON storage.objects;
DROP POLICY IF EXISTS "public_storage_update_transfers" ON storage.objects;
DROP POLICY IF EXISTS "public_storage_delete_transfers" ON storage.objects;
DROP POLICY IF EXISTS "anon_upload" ON storage.objects;
DROP POLICY IF EXISTS "anon_read" ON storage.objects;
DROP POLICY IF EXISTS "anon_update" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;

-- 3. Create permissive RLS policies on storage.objects for the 'transfers' bucket
CREATE POLICY "public_storage_insert_transfers"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'transfers');

CREATE POLICY "public_storage_select_transfers"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'transfers');

CREATE POLICY "public_storage_update_transfers"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'transfers')
WITH CHECK (bucket_id = 'transfers');

CREATE POLICY "public_storage_delete_transfers"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (bucket_id = 'transfers');


-- -----------------------------------------------------------------------------
-- PART 2: FIX public.transfers TABLE RLS POLICIES
-- -----------------------------------------------------------------------------

-- 1. Ensure table exists with correct columns
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_path text NOT NULL,
  content_type text DEFAULT 'application/octet-stream',
  subject text,
  message text,
  sender_email text,
  recipient_emails text,
  password_hash text,
  user_id text,
  transfer_type text DEFAULT 'link',
  download_count integer DEFAULT 0,
  max_downloads integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- 3. Drop all old table policies
DROP POLICY IF EXISTS "anon_insert" ON public.transfers;
DROP POLICY IF EXISTS "anon_update" ON public.transfers;
DROP POLICY IF EXISTS "anon_select" ON public.transfers;
DROP POLICY IF EXISTS "anon_delete" ON public.transfers;
DROP POLICY IF EXISTS "secure_transfer_insert" ON public.transfers;
DROP POLICY IF EXISTS "secure_transfer_select" ON public.transfers;
DROP POLICY IF EXISTS "secure_transfer_update" ON public.transfers;
DROP POLICY IF EXISTS "secure_transfer_delete" ON public.transfers;
DROP POLICY IF EXISTS "public_insert_transfers" ON public.transfers;
DROP POLICY IF EXISTS "public_select_transfers" ON public.transfers;
DROP POLICY IF EXISTS "public_update_transfers" ON public.transfers;
DROP POLICY IF EXISTS "public_delete_transfers" ON public.transfers;

-- 4. Create universal table policies
CREATE POLICY "public_insert_transfers"
ON public.transfers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "public_select_transfers"
ON public.transfers
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "public_update_transfers"
ON public.transfers
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "public_delete_transfers"
ON public.transfers
FOR DELETE
TO anon, authenticated
USING (true);

-- 5. Realtime Replication for Dashboard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'transfers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
  END IF;
END $$;
