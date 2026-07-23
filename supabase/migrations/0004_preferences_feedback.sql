-- 0004: structured user preferences, 20-style vocabulary remap,
-- collection summaries view, feedback table, notification prefs.

-- ---------- profiles: structured preferences + notification prefs ----------

alter table public.profiles
  add column preferred_styles text[] not null default '{}',
  add column favorite_colors text[] not null default '{}',
  add column favorite_brands text[] not null default '{}',
  add column notification_prefs jsonb not null default '{}';

-- style_preferences stays as the free-form "additional style notes" field;
-- structured prefs live in the three arrays above. Old onboarding blobs are
-- left in place (they keep feeding AI prompts harmlessly as notes).
comment on column public.profiles.style_preferences is
  'Free-form additional style notes (structured prefs live in preferred_styles/favorite_colors/favorite_brands)';

-- notification_prefs: { "price_drop": bool, "restock": bool } — absent key = enabled.
comment on column public.profiles.notification_prefs is
  'Push notification opt-outs by kind ({price_drop, restock}); absent key = enabled';

-- ---------- items: remap the 12-tag style vocabulary onto the 20 slugs ----------
-- Only 5 canonical values change; user free-typed tags pass through untouched.
-- casual/elegant/streetwear/sporty/vintage/business/boho map to themselves.

update public.items
set style_tags = (
  select coalesce(array_agg(distinct case tag
    when 'minimalist' then 'minimal'
    when 'formal' then 'elegant'
    when 'party' then 'trendy'
    when 'beach' then 'casual'
    when 'cozy' then 'casual'
    else tag end), '{}')
  from unnest(style_tags) as tag
)
where style_tags && array['minimalist', 'formal', 'party', 'beach', 'cozy'];

-- ---------- collection summaries (list screen: cover + count + colors) ----------
-- security_invoker: the view runs with the caller's role, so the RLS policies
-- on collections/collection_items/items apply as if querying them directly.

create view public.collection_summaries
with (security_invoker = on) as
select
  c.id,
  c.user_id,
  c.name,
  c.is_system,
  c.sort_order,
  c.created_at,
  coalesce(agg.item_count, 0) as item_count,
  agg.cover_image_path,
  coalesce(cols.item_colors, '{}') as item_colors
from public.collections c
left join lateral (
  select
    count(*)::int as item_count,
    (array_agg(i.image_path order by ci.added_at asc)
       filter (where i.image_path is not null))[1] as cover_image_path
  from public.collection_items ci
  join public.items i on i.id = ci.item_id
  where ci.collection_id = c.id
) agg on true
left join lateral (
  select array_agg(color) as item_colors
  from (
    select distinct color
    from public.collection_items ci
    join public.items i on i.id = ci.item_id,
         unnest(i.colors) as color
    where ci.collection_id = c.id
    limit 12
  ) distinct_colors
) cols on true;

grant select on public.collection_summaries to authenticated;

-- ---------- feedback (Support → Send Feedback) ----------

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  locale text,
  app_version text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Insert-only for users; reading happens via dashboard/service role.
create policy "feedback: own insert" on public.feedback
  for insert with check (user_id = auth.uid());

grant insert on public.feedback to authenticated;
grant all on public.feedback to service_role;
