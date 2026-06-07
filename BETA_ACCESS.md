# Eddies — Beta Access Guide

## When a user requests access

You'll get an email at **eddies.dev@atomicmail.io** with their email address.

---

## Generate a new code (auto-unique, never repeats)

Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/jqmrklutacyefasquvto/sql/new).

**One code — 7-day expiry, single-use:**

```sql
INSERT INTO invite_codes (code, max_uses, expires_at)
VALUES (
  'EDDS-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4))
         || '-'
         || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
  1,
  now() + interval '7 days'
)
RETURNING code, expires_at;
```

The `RETURNING` clause prints the generated code so you can copy it immediately.  
The `unique` constraint on the `code` column guarantees no duplicates — if there's a collision (astronomically unlikely) Postgres will throw and you just re-run.

**Batch of 5 codes — 7-day expiry:**

```sql
INSERT INTO invite_codes (code, max_uses, expires_at)
SELECT
  'EDDS-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4))
           || '-'
           || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
  1,
  now() + interval '7 days'
FROM generate_series(1, 5)
RETURNING code, expires_at;
```

**Permanent code (no expiry):**

```sql
INSERT INTO invite_codes (code, max_uses)
VALUES (
  'EDDS-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4))
           || '-'
           || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4)),
  1
)
RETURNING code;
```

---

## Send the code to the user

Reply to their request email:

> Hi,
>
> Here's your Eddies invite code: **EDDS-XXXX-YYYY**
>
> Open the app, enter the code on the invite screen, and hit VALIDATE.  
> This code expires in 7 days and can only be used once.
>
> — Eddies

---

## View active (pending) codes

```sql
SELECT code, uses_count, max_uses, is_active, expires_at, created_at
FROM invite_codes
WHERE is_active = true
  AND (expires_at IS NULL OR expires_at > now())
ORDER BY created_at DESC;
```

---

## Delete used codes

Codes that have been fully consumed (`uses_count >= max_uses` or `is_active = false`):

```sql
DELETE FROM invite_codes
WHERE is_active = false
   OR (max_uses IS NOT NULL AND uses_count >= max_uses);
```

---

## Delete expired codes

```sql
DELETE FROM invite_codes
WHERE expires_at IS NOT NULL
  AND expires_at < now();
```

---

## Full cleanup — delete used AND expired in one shot

```sql
DELETE FROM invite_codes
WHERE is_active = false
   OR (max_uses IS NOT NULL AND uses_count >= max_uses)
   OR (expires_at IS NOT NULL AND expires_at < now());
```

---

## Deactivate a specific code manually

```sql
UPDATE invite_codes SET is_active = false
WHERE code = 'EDDS-XXXX-YYYY';
```

---

## How codes work

| Rule | Detail |
|---|---|
| Unique by schema | `code` column has a `UNIQUE` constraint — Postgres rejects any duplicate |
| Single-use | `max_uses = 1` — deactivates after first use automatically |
| Case-insensitive | User can type lowercase; app uppercases before calling the Edge Function |
| Expiry optional | Set `expires_at` when generating; omit for permanent codes |
| Edge Function | Rejects `is_active = false`, `expires_at < now()`, or `uses_count >= max_uses` |

---

## Secrets reference

| Secret | Value | How to update |
|---|---|---|
| `RESEND_API_KEY` | Resend API key | `npx supabase secrets set RESEND_API_KEY=re_xxx` |
| `FROM_EMAIL` | `onboarding@resend.dev` | `npx supabase secrets set FROM_EMAIL=xxx` |
| `OWNER_EMAIL` | `eddies.dev@atomicmail.io` | `npx supabase secrets set OWNER_EMAIL=xxx` |
