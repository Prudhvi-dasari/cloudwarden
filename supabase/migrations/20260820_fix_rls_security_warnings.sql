-- ==============================================================================
-- Migration: Fix Supabase Security Linter Warnings (Clean Type-Cast Version)
-- Target: public.transfers table
-- ==============================================================================

-- 1. Enable Row Level Security on transfers
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- 2. Drop the overly permissive legacy policies
DROP POLICY IF EXISTS "anon_insert" ON public.transfers;
DROP POLICY IF EXISTS "anon_update" ON public.transfers;
DROP POLICY IF EXISTS "anon_select" ON public.transfers;
DROP POLICY IF EXISTS "anon_delete" ON public.transfers;
DROP POLICY IF EXISTS "secure_transfer_insert" ON public.transfers;
DROP POLICY IF EXISTS "secure_transfer_select" ON public.transfers;
DROP POLICY IF EXISTS "secure_transfer_update" ON public.transfers;
DROP POLICY IF EXISTS "secure_transfer_delete" ON public.transfers;

-- 3. Secure INSERT Policy
CREATE POLICY "secure_transfer_insert"
ON public.transfers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  share_id IS NOT NULL AND
  char_length(share_id) >= 6 AND
  file_name IS NOT NULL AND
  char_length(file_name) >= 1 AND
  expires_at > now()
);

-- 4. Secure SELECT Policy (Type cast explicitly on both sides to prevent text = uuid error)
CREATE POLICY "secure_transfer_select"
ON public.transfers
FOR SELECT
TO anon, authenticated
USING (
  expires_at > now() OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
);

-- 5. Secure UPDATE Policy
CREATE POLICY "secure_transfer_update"
ON public.transfers
FOR UPDATE
TO anon, authenticated
USING (
  expires_at > now()
)
WITH CHECK (
  expires_at > now()
);

-- 6. Secure DELETE Policy (Type cast explicitly on both sides)
CREATE POLICY "secure_transfer_delete"
ON public.transfers
FOR DELETE
TO anon, authenticated
USING (
  (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text) OR
  user_id IS NULL OR
  expires_at <= now()
);

-- 7. Realtime Replication for Dashboard
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'transfers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
  END IF;
END $$;
