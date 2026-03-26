create table license_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  telegram_chat_id text,
  machine_id text not null,
  request_ip text,
  user_agent text,
  status text not null default 'pending',
  license_key text,
  expires_at date,
  features text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_license_requests_machine_status
  on license_requests (machine_id, status);

create index if not exists idx_license_requests_request_ip_created_at
  on license_requests (request_ip, created_at desc);

create unique index if not exists uniq_pending_license_request_per_machine
  on license_requests (machine_id)
  where status = 'pending';

-- Migration (run if table already exists):
-- ALTER TABLE license_requests ALTER COLUMN email DROP NOT NULL;
-- ALTER TABLE license_requests ADD COLUMN IF NOT EXISTS telegram_chat_id text;
-- ALTER TABLE license_requests ADD COLUMN IF NOT EXISTS request_ip text;
-- ALTER TABLE license_requests ADD COLUMN IF NOT EXISTS user_agent text;
-- CREATE INDEX IF NOT EXISTS idx_license_requests_machine_status ON license_requests (machine_id, status);
-- CREATE INDEX IF NOT EXISTS idx_license_requests_request_ip_created_at ON license_requests (request_ip, created_at DESC);
-- CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_license_request_per_machine ON license_requests (machine_id) WHERE status = 'pending';
