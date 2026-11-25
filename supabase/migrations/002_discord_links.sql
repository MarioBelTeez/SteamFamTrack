-- SteamFamTrack Phase 3: Discord user <-> Steam & default family links
CREATE TABLE IF NOT EXISTS steamfam.discord_links (
  discord_user_id TEXT PRIMARY KEY,
  steam_input TEXT NOT NULL,
  default_family_slug TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE steamfam.discord_links ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE steamfam.discord_links TO service_role;
