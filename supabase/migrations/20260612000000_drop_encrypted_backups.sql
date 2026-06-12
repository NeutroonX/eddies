-- Drop the orphaned encrypted_backups feature (Beta v2 M6 reverted in 844d1f0).
-- The client code was removed but the remote table/trigger/function remained.
-- Table holds 0 rows; nothing references it (FK points outward to auth.users),
-- and no edge function depends on it.
--
-- Dropping the table also removes its policies, indexes and the BEFORE INSERT
-- trigger. The trigger function is a standalone object, so drop it explicitly.
-- Rollback: supabase/migrations/rollback/20260612000000_drop_encrypted_backups.down.sql

drop table if exists public.encrypted_backups cascade;
drop function if exists public.enforce_backup_limit();
