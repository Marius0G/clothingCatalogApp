-- =============================================================================
-- 0001_init.sql — full v1 schema for the clothing catalog app
-- Conventions:
--   * every user-owned table has RLS with user_id = auth.uid()
--   * catalog/ai tables are written only by service-role (edge functions)
--   * timestamps are timestamptz, defaults now()
-- =============================================================================

-- ---------- profiles ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  sex text check (sex in ('male', 'female', 'other')),
  birth_year int check (birth_year between 1900 and 2100),
  sizes jsonb not null default '{}',
  style_preferences text,
  locale text not null default 'ro' check (locale in ('ro', 'en')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own read" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: own update" on public.profiles
  for update using (id = auth.uid());

-- ---------- collections ----------

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.collections enable row level security;

create policy "collections: own all" on public.collections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Auto-provision profile + system Wishlist collection on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.collections (user_id, name, is_system)
  values (new.id, 'Wishlist', true);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- items (wishlist + wardrobe unified) ----------

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('wishlist', 'wardrobe')),
  source text not null check (source in ('photo', 'link')),
  title text,
  brand text,
  category text check (category in ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'accessory')),
  subcategory text,
  colors text[] not null default '{}',
  style_tags text[] not null default '{}',
  ai_tagged boolean not null default false,
  image_path text,
  original_image_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_user_status_idx on public.items (user_id, status, created_at desc);

alter table public.items enable row level security;

create policy "items: own all" on public.items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ---------- collection_items (many-to-many) ----------

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, item_id)
);

alter table public.collection_items enable row level security;

create policy "collection_items: own all" on public.collection_items
  for all using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

-- ---------- tracked products (link-sourced items) ----------

create table public.tracked_products (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  canonical_url text,
  store text not null default 'generic'
    check (store in ('zara', 'bershka', 'hm', 'vinted', 'generic')),
  external_id text,
  currency text,
  current_price numeric,
  original_price numeric,
  sizes_available jsonb,
  in_stock boolean,
  parse_method text check (parse_method in ('dedicated', 'og', 'llm')),
  fetch_strategy text not null default 'server' check (fetch_strategy in ('server', 'client')),
  last_checked_at timestamptz,
  check_failures int not null default 0,
  stale boolean not null default false,
  created_at timestamptz not null default now()
);

create index tracked_products_recheck_idx
  on public.tracked_products (stale, last_checked_at);

alter table public.tracked_products enable row level security;

create policy "tracked_products: own all" on public.tracked_products
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- product snapshots (price/stock history, append-only) ----------

create table public.product_snapshots (
  id bigint generated always as identity primary key,
  tracked_product_id uuid not null references public.tracked_products (id) on delete cascade,
  price numeric,
  currency text,
  in_stock boolean,
  sizes_available jsonb,
  captured_at timestamptz not null default now()
);

create index product_snapshots_product_idx
  on public.product_snapshots (tracked_product_id, captured_at desc);

alter table public.product_snapshots enable row level security;

create policy "product_snapshots: own read" on public.product_snapshots
  for select using (
    exists (
      select 1 from public.tracked_products tp
      where tp.id = tracked_product_id and tp.user_id = auth.uid()
    )
  );
-- inserts happen via edge functions (service role bypasses RLS)

-- ---------- alerts ----------

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tracked_product_id uuid not null references public.tracked_products (id) on delete cascade,
  kind text not null check (kind in ('price_drop', 'restock')),
  threshold numeric,
  size text,
  active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create index alerts_product_idx on public.alerts (tracked_product_id) where active;

alter table public.alerts enable row level security;

create policy "alerts: own all" on public.alerts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- push tokens ----------

create table public.push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_token text not null,
  platform text check (platform in ('ios', 'android')),
  device_name text,
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_token)
);

alter table public.push_tokens enable row level security;

create policy "push_tokens: own all" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- notifications (outbox + in-app history) ----------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}',
  sent_at timestamptz,
  receipt_status text,
  created_at timestamptz not null default now()
);

create index notifications_unsent_idx on public.notifications (created_at) where sent_at is null;

alter table public.notifications enable row level security;

create policy "notifications: own read" on public.notifications
  for select using (user_id = auth.uid());
-- writes via service role only

-- ---------- catalog (affiliate feeds + scraped + organic) ----------

create table public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('affiliate', 'scraped', 'organic')),
  network text not null,
  merchant text,
  external_id text not null,
  url text not null,
  affiliate_url text,
  title text not null,
  brand text,
  image_url text,
  price numeric,
  currency text,
  category text,
  colors text[] not null default '{}',
  gender text check (gender in ('male', 'female', 'unisex')),
  attrs jsonb not null default '{}',
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (network, external_id)
);

create index catalog_products_browse_idx
  on public.catalog_products (category, gender) where active;

alter table public.catalog_products enable row level security;

create policy "catalog_products: authenticated read" on public.catalog_products
  for select to authenticated using (true);
-- writes via service role only (ingest-affiliate / scrape-catalog / parse-product)

-- ---------- recommendations cache ----------

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('outfit', 'purchase')),
  input_hash text not null,
  payload jsonb not null,
  model text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index recommendations_lookup_idx
  on public.recommendations (user_id, kind, input_hash);

alter table public.recommendations enable row level security;

create policy "recommendations: own read" on public.recommendations
  for select using (user_id = auth.uid());
-- writes via service role only (recommend-* functions)

-- ---------- AI usage (rate caps / credit protection) ----------

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  endpoint text not null check (endpoint in ('tag', 'extract', 'outfit', 'purchase')),
  model text,
  prompt_tokens int,
  completion_tokens int,
  created_at timestamptz not null default now()
);

create index ai_usage_caps_idx on public.ai_usage (user_id, endpoint, created_at desc);

alter table public.ai_usage enable row level security;
-- no policies: clients have zero access; service role bypasses RLS

-- ---------- grants ----------
-- Newer Supabase projects no longer auto-grant privileges on public tables;
-- RLS policies above are the row filter, these are the table-level door.

grant usage on schema public to authenticated, service_role;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, update, delete on public.collection_items to authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.tracked_products to authenticated;
grant select, insert, update, delete on public.alerts to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant select on public.product_snapshots to authenticated;
grant select on public.notifications to authenticated;
grant select on public.catalog_products to authenticated;
grant select on public.recommendations to authenticated;
-- ai_usage: intentionally no client grants

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------- storage: private photo bucket ----------

insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', false);

-- path convention: {user_id}/{item_id}/{main|original}.png
create policy "item-photos: own read" on storage.objects
  for select to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "item-photos: own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "item-photos: own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "item-photos: own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);
