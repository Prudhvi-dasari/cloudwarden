-- Who paid, separate from author_id (the signed-in person who created the row).
ALTER TABLE public.group_posts ADD COLUMN IF NOT EXISTS payer_member_id UUID;

CREATE TABLE IF NOT EXISTS public.group_post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

DO $$ BEGIN
  ALTER TABLE public.group_post_likes
    ADD CONSTRAINT group_post_likes_post_user_uniq UNIQUE (post_id, user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object OR unique_violation THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS group_post_likes_group_idx ON public.group_post_likes (group_id);
CREATE INDEX IF NOT EXISTS group_post_likes_user_idx ON public.group_post_likes (user_id);

CREATE TABLE IF NOT EXISTS public.group_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.group_posts(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_member_id UUID NOT NULL,
  to_member_id UUID NOT NULL,
  amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS group_settlements_group_idx ON public.group_settlements (group_id, created_at);
CREATE INDEX IF NOT EXISTS group_settlements_actor_idx ON public.group_settlements (actor_user_id);

ALTER TABLE public.group_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_settlements ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.group_post_likes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.group_settlements TO authenticated;

DROP POLICY IF EXISTS "likes_select" ON public.group_post_likes;
DROP POLICY IF EXISTS "likes_insert" ON public.group_post_likes;
DROP POLICY IF EXISTS "likes_delete" ON public.group_post_likes;

CREATE POLICY "likes_select"
  ON public.group_post_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = group_post_likes.group_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_post_likes.group_id AND g.owner_id = auth.uid()
    )
  );

CREATE POLICY "likes_insert"
  ON public.group_post_likes FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.group_members m
        WHERE m.group_id = group_id AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_id AND g.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "likes_delete"
  ON public.group_post_likes FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "settlements_select" ON public.group_settlements;
DROP POLICY IF EXISTS "settlements_insert" ON public.group_settlements;
DROP POLICY IF EXISTS "settlements_delete" ON public.group_settlements;

CREATE POLICY "settlements_select"
  ON public.group_settlements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members m
      WHERE m.group_id = group_settlements.group_id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_settlements.group_id AND g.owner_id = auth.uid()
    )
  );

CREATE POLICY "settlements_insert"
  ON public.group_settlements FOR INSERT
  WITH CHECK (
    actor_user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.group_members m
        WHERE m.group_id = group_id AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_id AND g.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "settlements_delete"
  ON public.group_settlements FOR DELETE
  USING (actor_user_id = auth.uid());

ALTER TABLE public.group_posts REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
ALTER TABLE public.group_post_likes REPLICA IDENTITY FULL;
ALTER TABLE public.group_settlements REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication is missing.';
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY ARRAY['groups', 'group_members', 'group_posts', 'group_post_likes', 'group_settlements']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
;
