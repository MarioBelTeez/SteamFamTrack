# Changelog — SteamFamTrack (`steamft.com`)

All notable releases of **SteamFamTrack** (Web App, Discord Activity, and `SteamFT` Discord Bot) are documented here.

## [v1.1.0] — 2026-11-27
### Added
- **Family Trophy Cabinet & Achievement Tracker:** Replaced the volume-heavy Hall of Fame cards with 10–11 balanced trophies across **Skill/Rate** (`High Roller`, `Purist`, `Crown Jewel`), **Playtime** (`No-Lifer`, `One-Trick`), **Squad** (`Team Player`, `Target Locked`, `Bench MVP`), and **Volume** (`Biggest Whale`, `Library King`, `Exclusive Dealer`), complete with a clickable Member Trophy Rack and 2nd-place runner-up tracking.
- **Interactive Power Rankings & Head-to-Head:** Added Top-3 Power Podium, earned member badges, `ALL`/`ACTIVE`/`WAITLIST` filter pills, sortable columns (`Excl. %`, `Avg/Game`, etc.), Power Score breakdown bars, and a collapsible 2-member Head-to-Head comparator.
- **`/profile` Flex Command & PNG Card:** Added `/profile [user?] [steam?] [region?]` to the `SteamFT` Discord bot, powered by `/api/steam/profile` and `/api/og/profile` (custom PNG flex card with Steam Level, catalog value, shareable count, total playtime hours, Top 5 Valuable Games, and Top 5 Most Played Games).
- **Account-Synced Region & Theme:** Pricing region and theme selection now persist to your Steam account (`steamfam.steam_preferences` via `/api/me/preferences`) and sync across web and Discord Activity.
- **Automated Release Announcements:** Added `.github/workflows/discord-release.yml` and `scripts/announce-release.mjs` to post versioned changelogs straight to `#steamft-updates`.

### Fixed
- **Discord Activity Steam Sign-In:** Clicking **Sign in with Steam** inside the Discord Activity now opens `https://steamft.com/api/auth/steam?discord_link=...` externally via `sdk.commands.openExternalLink` instead of navigating the Activity iframe to Steam OpenID (which caused a white screen).

## [v1.0.0] — 2026-11-26
### Launched
- Live on **`https://steamft.com`** with Discord Embedded Activity, `SteamFT` Discord Bot (`/link`, `/family`, `/check`, `/kos`), 8 Themes Studio palettes, Monthly/Weekly Deltas with buy/dry streaks, Multi-Swap & 2-Family Fair Splitter, Discount & Shared Wishlist Tracker, and AGPL-3.0 open-source release.
