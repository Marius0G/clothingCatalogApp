-- =============================================================================
-- 0003_outfit_engine_v2.sql — outfit engine v2 (spike: docs/spike-outfit-engine.md)
--   * items: structured attributes for deterministic filtering/scoring
--     (canonical English enum values; localized only at display time)
--   * items: wear tracking (times_worn / last_worn_at) + record_wear RPC
--   * outfits + outfit_items: saved outfits (previously ephemeral cache-only)
--   * outfit_feedback: persisted thumbs up/down (previously dead local state)
--   * profiles.no_go: things the user never wears, fed to the recommender
-- =============================================================================

-- ---------- items: structured attributes ----------

alter table public.items
  add column pattern text check (pattern in
    ('solid', 'stripe', 'check', 'floral', 'print', 'melange', 'denim', 'other')),
  add column material text check (material in
    ('cotton', 'denim', 'wool', 'knit', 'linen', 'leather', 'suede', 'silk',
     'synthetic', 'fleece', 'other')),
  add column fit text check (fit in
    ('slim', 'regular', 'relaxed', 'oversized', 'straight', 'wide')),
  add column formality int check (formality between 1 and 5),
  add column warmth int check (warmth between 1 and 5),
  -- element values are app-validated (zod enums); no DB check so the
  -- vocabulary can evolve without a migration
  add column seasons text[] not null default '{}',
  add column occasions text[] not null default '{}',
  add column layer text check (layer in ('base', 'mid', 'outer', 'none')),
  add column times_worn int not null default 0,
  add column last_worn_at timestamptz;

-- ---------- items: wear tracking RPC ----------
-- Security invoker: RLS on items restricts the update to the caller's rows.

create or replace function public.record_wear(p_item_ids uuid[])
returns void
language sql
as $$
  update public.items
  set times_worn = times_worn + 1,
      last_worn_at = now()
  where id = any (p_item_ids)
    and user_id = auth.uid();
$$;

grant execute on function public.record_wear(uuid[]) to authenticated;

-- ---------- profiles: never-wears list ----------

alter table public.profiles add column no_go text;

-- ---------- saved outfits ----------

create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  rationale text,
  occasion text,
  source text not null default 'ai' check (source in ('ai', 'manual')),
  created_at timestamptz not null default now()
);

create index outfits_user_idx on public.outfits (user_id, created_at desc);

alter table public.outfits enable row level security;

create policy "outfits: own all" on public.outfits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.outfit_items (
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  position int not null default 0,
  primary key (outfit_id, item_id)
);

alter table public.outfit_items enable row level security;

create policy "outfit_items: own all" on public.outfit_items
  for all using (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_id and o.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_id and o.user_id = auth.uid()
    )
  );

-- ---------- outfit feedback (thumbs up/down on generated outfits) ----------

create table public.outfit_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_ids uuid[] not null,
  occasion text,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now()
);

create index outfit_feedback_user_idx on public.outfit_feedback (user_id, created_at desc);

alter table public.outfit_feedback enable row level security;

create policy "outfit_feedback: own all" on public.outfit_feedback
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- grants ----------

grant select, insert, update, delete on public.outfits to authenticated;
grant select, insert, update, delete on public.outfit_items to authenticated;
grant select, insert, delete on public.outfit_feedback to authenticated;
