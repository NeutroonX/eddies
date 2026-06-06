create table public.invite_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  max_uses    int,
  uses_count  int not null default 0,
  is_active   boolean not null default true,
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- Default-deny for all client roles.
alter table public.invite_codes enable row level security;
