-- SteamFamTrack: Per-Steam-account preferences (regional pricing persisted across web & Discord Activity)
CREATE TABLE IF NOT EXISTS steamfam.steam_preferences (
  steam_id64 TEXT PRIMARY KEY,
  preferred_region TEXT NOT NULL DEFAULT 'ma',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE steamfam.steam_preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE steamfam.steam_preferences FROM anon, authenticated;
GRANT ALL ON TABLE steamfam.steam_preferences TO service_role;
