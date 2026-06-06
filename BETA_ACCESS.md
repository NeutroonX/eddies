# Eddies — Beta Access Guide

## When a user requests access

You'll get an email at **eddies.dev@atomicmail.io** with their email address.

---

## Generate a code for them

Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/jqmrklutacyefasquvto/sql/new) and run:

```sql
INSERT INTO invite_codes (code, max_uses)
VALUES ('EDDS-XXXX-YYYY', 1);
```

Replace `XXXX-YYYY` with anything you want. Examples:

```sql
-- Single person, one-time use
INSERT INTO invite_codes (code, max_uses)
VALUES ('EDDS-JOHN-2024', 1);

-- Batch of 5 codes at once
INSERT INTO invite_codes (code, max_uses)
VALUES
  ('EDDS-A1B2-C3D4', 1),
  ('EDDS-E5F6-G7H8', 1),
  ('EDDS-J9K0-L1M2', 1),
  ('EDDS-N3P4-Q5R6', 1),
  ('EDDS-S7T8-U9V0', 1);
```

---

## Send the code to the user

Reply to their request email:

> Hi,
>
> Here's your Eddies invite code: **EDDS-XXXX-YYYY**
>
> Open the app, enter the code on the invite screen, and hit VALIDATE.
>
> — Eddies

---

## How codes work

| Rule | Detail |
|---|---|
| Single-use | `max_uses = 1` — deactivates after one use automatically |
| Case-insensitive | User can type lowercase, app uppercases it before checking |
| No expiry by default | Add `expires_at` if you want a time limit |

### Add an expiry date (optional)

```sql
INSERT INTO invite_codes (code, max_uses, expires_at)
VALUES ('EDDS-TEMP-0001', 1, now() + interval '7 days');
```

---

## Check active codes

```sql
SELECT code, uses_count, max_uses, is_active, created_at
FROM invite_codes
WHERE is_active = true
ORDER BY created_at DESC;
```

---

## Deactivate a code manually

```sql
UPDATE invite_codes SET is_active = false
WHERE code = 'EDDS-XXXX-YYYY';
```

---

## Secrets reference

| Secret | Value | How to update |
|---|---|---|
| `RESEND_API_KEY` | Resend API key | `npx supabase secrets set RESEND_API_KEY=re_xxx` |
| `FROM_EMAIL` | `onboarding@resend.dev` | `npx supabase secrets set FROM_EMAIL=xxx` |
| `OWNER_EMAIL` | `eddies.dev@atomicmail.io` | `npx supabase secrets set OWNER_EMAIL=xxx` |
