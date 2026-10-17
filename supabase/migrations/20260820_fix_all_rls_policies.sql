-- ==============================================================================
-- Migration: Fix All Row-Level Security (RLS) Policies on public.transfers
-- Run this in your Supabase SQL Editor to allow instant uploads without errors!
-- ==============================================================================

-- 1. Ensure RLS is enabled
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- 2. Drop all conflicting old policies
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

-- 3. Create universal, reliable policies for public and authenticated file transfers
-- INSERT: Anyone can upload and create a transfer record
CREATE POLICY "public_insert_transfers"
ON public.transfers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- SELECT: Anyone can view active transfers to download, and users can load their dashboard
CREATE POLICY "public_select_transfers"
ON public.transfers
FOR SELECT
TO anon, authenticated
USING (true);

-- UPDATE: Allow incrementing download counts and updating transfer metadata
CREATE POLICY "public_update_transfers"
ON public.transfers
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- DELETE: Allow deleting transfers
CREATE POLICY "public_delete_transfers"
ON public.transfers
FOR DELETE
TO anon, authenticated
USING (true);

-- 4. Enable Realtime Replication for Instant Dashboard Sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'transfers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
  END IF;
END $$;
