-- =============================================================================
-- 0002_alerts_cron.sql — scheduled re-checks + push dispatch plumbing
-- Cron jobs call edge functions over HTTP. The target URL and service key are
-- read from Vault secrets ('project_url', 'service_role_key') so the same
-- migration works locally and in the cloud; if the secrets are missing the
-- invoker is a no-op. Seed them per environment (see SETUP.md).
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.invoke_edge_function(function_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url
    from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if base_url is null or service_key is null then
    raise notice 'edge invoke skipped: vault secrets missing';
    return;
  end if;
  perform net.http_post(
    url := base_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.invoke_edge_function(text) from public, anon, authenticated;

select cron.schedule(
  'recheck-products-every-6h',
  '15 */6 * * *',
  $$select public.invoke_edge_function('recheck-products')$$
);

select cron.schedule(
  'push-dispatch-every-5m',
  '*/5 * * * *',
  $$select public.invoke_edge_function('push-dispatch')$$
);
