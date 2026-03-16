create table license_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  machine_id text not null,
  status text not null default 'pending',
  license_key text,
  expires_at date,
  features text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
