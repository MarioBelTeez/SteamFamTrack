-- SteamFamTrack: Account-based families (SteamID64 ownership, private by default, 1 active family per Steam account)
ALTER TABLE steamfam.families
  ADD COLUMN IF NOT EXISTS owner_steam_id64 TEXT;

ALTER TABLE steamfam.families
  ALTER COLUMN edit_key_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_families_owner_steam_id64
  ON steamfam.families(owner_steam_id64);

CREATE INDEX IF NOT EXISTS idx_family_members_steam_id64
  ON steamfam.family_members(steam_id64);

-- Enforce: a Steam account can only be an active member of 1 family at a time,
-- while still allowing them on multiple waitlists.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_member_steam_id64
  ON steamfam.family_members(steam_id64)
  WHERE is_waitlist = false AND steam_id64 IS NOT NULL;
