-- Beta v2 §5.2 / M6 — Encrypted cloud backup store.
-- The server is UNTRUSTED for confidentiality: it only ever holds an opaque
-- AES-256-GCM envelope (salt + iv + ciphertext + tag, see src/lib/crypto/envelope.ts).
-- Plaintext and the decryption key never reach this table.
--
-- Free-tier safety: per-row blob is hard-capped at 1 MiB and per-user row count at
-- 10 (client keeps only the last 3). These are enforced in the DB, so a buggy or
-- malicious client cannot exhaust the 500 MB Postgres quota.

create table public.encrypted_backups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  app_version text,                          -- nullable: tolerate older clients
  schema_ver  int not null,
  byte_size   int not null check (byte_size > 0),
  blob        bytea not null
    check (octet_length(blob) <= 1048576)    -- hard 1 MiB per-row storage cap
);

-- List + prune-to-N most-recent per user. Covers the listing projection so the
-- metadata query is index-only and never touches TOASTed blob pages.
create index encrypted_backups_user_created_idx
  on public.encrypted_backups (user_id, created_at desc)
  include (id, app_version, schema_ver, byte_size);

-- ── Row-level security: default-deny, owner-only, immutable ──────────────────
alter table public.encrypted_backups enable row level security;
alter table public.encrypted_backups force row level security;  -- owner not exempt

-- Defense-in-depth: RLS is the gate, but also remove grant-layer access so RLS
-- is not the *only* barrier (Supabase grants ALL to anon/authenticated by default).
revoke all on public.encrypted_backups from anon;
revoke update on public.encrypted_backups from authenticated;
grant select, insert, delete on public.encrypted_backups to authenticated;

-- (select auth.uid()) forces single evaluation per statement (Supabase guidance).
create policy "owner can read" on public.encrypted_backups
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "owner can insert" on public.encrypted_backups
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "owner can delete" on public.encrypted_backups
  for delete to authenticated using ((select auth.uid()) = user_id);

-- No update policy: backups are immutable. Retention (keep last N) is enforced
-- client-side; the trigger below is the hard server-side ceiling.

-- ── Hard per-user row-count ceiling ─────────────────────────────────────────
create or replace function public.enforce_backup_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
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

-- The trigger function must not be callable as a PostgREST RPC. Triggers run in
-- the table-owner context and don't need EXECUTE on the calling role, so revoke
-- it everywhere to close the /rest/v1/rpc exposure (flagged by the security advisor).
revoke execute on function public.enforce_backup_limit() from public, anon, authenticated;
