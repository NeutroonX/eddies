-- Rollback for 20260612000000_drop_encrypted_backups.sql
-- Recreates the encrypted_backups table, indexes, RLS policies, the backup-limit
-- trigger function, and its trigger — reconstructed exactly from the live M6 schema
-- (migrations 20260611121845_encrypted_backups + 20260611121915_lockdown_backup_limit_fn).
-- No data is restored (the dropped table held 0 rows).

create table public.encrypted_backups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  app_version text,
  schema_ver  integer not null,
  byte_size   integer not null check (byte_size > 0),
  blob        bytea not null check (octet_length(blob) <= 1048576)
);

create index encrypted_backups_user_created_idx
  on public.encrypted_backups using btree (user_id, created_at desc)
  include (id, app_version, schema_ver, byte_size);

-- RLS: owner-scoped, no UPDATE policy (backups are immutable).
alter table public.encrypted_backups enable row level security;

create policy "owner can read" on public.encrypted_backups
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner can insert" on public.encrypted_backups
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "owner can delete" on public.encrypted_backups
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Cap each user at 10 stored backups.
create or replace function public.enforce_backup_limit()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $$
begin
  if (select count(*) from public.encrypted_backups where user_id = new.user_id) >= 10 then
    raise exception 'backup_limit_exceeded';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_backup_limit
  before insert on public.encrypted_backups
  for each row execute function public.enforce_backup_limit();
