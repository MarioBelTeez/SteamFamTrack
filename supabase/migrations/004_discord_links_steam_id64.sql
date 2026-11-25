-- SteamFamTrack: Add steam_id64 to discord_links so Discord users auto-resolve their account-based family
ALTER TABLE steamfam.discord_links
  ADD COLUMN IF NOT EXISTS steam_id64 TEXT;

CREATE INDEX IF NOT EXISTS idx_discord_links_steam_id64
  ON steamfam.discord_links(steam_id64);
