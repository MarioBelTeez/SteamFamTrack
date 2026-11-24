-- SteamFamTrack isolated schema (safe to coexist with other apps on self-hosted Supabase)
CREATE SCHEMA IF NOT EXISTS steamfam;

-- Lock down from browser roles; all access goes through Next.js server routes using service_role
REVOKE ALL ON SCHEMA steamfam FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA steamfam TO service_role;

CREATE TABLE IF NOT EXISTS steamfam.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'ma',
  edit_key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS steamfam.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES steamfam.families(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  steam_input TEXT NOT NULL,
  steam_id64 TEXT,
  persona_name TEXT,
  avatar_url TEXT,
  join_date DATE,
  is_waitlist BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_members_family_id
  ON steamfam.family_members(family_id);

CREATE TABLE IF NOT EXISTS steamfam.monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES steamfam.families(id) ON DELETE CASCADE,
  snapshot_month TEXT NOT NULL, -- YYYY-MM
  region TEXT NOT NULL,
  unique_games_count INT NOT NULL,
  unique_catalog_value NUMERIC(12, 2) NOT NULL,
  sum_copies_count INT NOT NULL,
  sum_copies_value NUMERIC(12, 2) NOT NULL,
  member_breakdown JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_family_id
  ON steamfam.monthly_snapshots(family_id);

CREATE TABLE IF NOT EXISTS steamfam.app_price_cache (
  appid INT NOT NULL,
  region TEXT NOT NULL,
  name TEXT,
  raw_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_free BOOLEAN NOT NULL DEFAULT false,
  family_sharing_excluded BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (appid, region)
);

-- Defense in depth: RLS enabled on all tables (service_role bypasses RLS; anon/authenticated get 0 rows)
ALTER TABLE steamfam.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE steamfam.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE steamfam.monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE steamfam.app_price_cache ENABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA steamfam TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA steamfam TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA steamfam GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA steamfam GRANT ALL ON SEQUENCES TO service_role;
