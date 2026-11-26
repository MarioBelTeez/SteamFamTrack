# SteamFamTrack

[![CI](https://github.com/MarioBelTeez/SteamFamTrack/actions/workflows/ci.yml/badge.svg)](https://github.com/MarioBelTeez/SteamFamTrack/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-E8002D.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A full-stack **Steam Family Contribution, Fairness, Swap & Discount Analyzer** built with Next.js, TypeScript, Tailwind CSS, Supabase, a standalone Discord Bot, and Discord Activity SDK support.

SteamDB tracks individual accounts, and Steam itself gives you no contribution breakdown, overlap matrix, monthly history, fairness meter, or swap/cooldown tooling for Steam Families. **SteamFamTrack** solves that for any friend group sharing up to 6 Steam Family slots using live Steam Web API data.

---

## Features

### Live Steam Roster & Private Account-Based Families
- **Steam OpenID 2.0 Sign-In:** Authenticate directly with Steam (HMAC-SHA256 `httpOnly` session cookie) to auto-load your active family and any families where you're waitlisted.
- **Visual Friends Picker & Bulk Paste:** Pick directly from your Steam Friends list (up to 300 friends) or bulk-paste up to 6 active Steam profile URLs, vanity names, or SteamID64s with live `/api/steam/resolve` avatar and library privacy verification.
- **Private Persistence & Preview Sandbox:** Families are scoped to your Steam account (enforcing 1 active family per Steam account while allowing unlimited waitlists), with a stateless **Preview Sandbox** for quick one-off checks.

### Contribution Analytics & Fairness
- **Contribution Board & Regional Pricing:** Ranks members by raw (non-discounted) regional store value (`MA` MENA-USD, `US`, `EU`, `GB`, `BR`, `JP`) showing Total Games, Exclusive Games, Shared Games, Exclusive Value, and `% Share`.
- **Family-Sharing Exclusion Filter:** Automatically detects and filters titles whose publisher opted out of Steam Family Sharing (missing Steam Store category `62`).
- **Fairness Meter ("Up Next to Buy / Add"):** Compares every member's share against the group average and highlights who is up next to contribute.
- **Family Leaderboard (`06`):** Hall of Fame award cards plus currency-normalized `S`/`A`/`B`/`C` Power Rankings.

### Library, Swaps & Ledger History
- **N × N Overlap Matrix & Shared Catalog:** Visualizes shared games between every pair of members alongside a fast, searchable, infinite-scroll deduplicated game catalog with Steam cover art.
- **Swap Simulator, Multi-Swap & 2-Family Fair Splitter:** Drag-and-drop active ↔ waitlist swap preview, multi-swap comparison, 2-family fair splitter for groups larger than 6, and automatic **1-year slot cooldown tracking** (`join_date + 1 year`).
- **Weekly & Monthly Ledger + Streaks:** Record snapshots (manually or via automated `/api/cron/snapshots`) to track new games, value deltas, `%` share shifts, and buy/dry streaks.

### Game Checker, Wishlists & Buyer Roulette
- **Game & Discount Checker (`05`):** Search any Steam game, AppID, or Store URL to check live regional pricing, discount %, Family Sharing support, and who in your family already owns it.
- **Discounts Browser, Family Wishlists & Buyer Roulette:** Browse top Steam specials, compare overlapping family wishlists, star/claim games ("Announce I'll Buy This"), and spin a Fairness-Weighted or Equal-Odds **Buyer Roulette**.

### Themes Studio, Discord Bot & Discord Activity
- **Themes Studio (`07`):** 8 live-previewable themes with zero-FOUC bootstrap — *BelTeez Crimson*, *Steam Deck Blue*, *Midnight Blurple*, *Catppuccin Violet*, *Obsidian Dark*, *Nord Frost*, *Daylight Light*, and *Lavender Paper*.
- **Discord Bot (`discord-bot/`):** Slash commands (`/link`, `/check`, `/family board|monthly|simulate|waitlist`) supporting both server installs and user installs (DMs/private channels), with verified Steam OpenID linking.
- **Discord Activity Embedded App SDK:** Run SteamFamTrack directly inside Discord voice/text channels via the OAuth2 bridge (`/api/auth/discord-activity`).

---

## Getting Started (Self-Hosting)

### 1. Clone & Configure

```bash
git clone https://github.com/MarioBelTeez/SteamFamTrack.git
cd SteamFamTrack
npm install
cp .env.example .env.local
```

Set at minimum:
- `STEAM_API_KEY` — Required for live Steam profile & library lookups ([get one here](https://steamcommunity.com/dev/apikey))
- `SESSION_SECRET` — Required for Steam OpenID 2.0 sessions (any random 32+ character string)
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` — Optional; enables private saved families, persistent 7-day price cache, snapshot history, and Discord bot linking

### 2. Apply Database Migrations (Optional, for Persistence)

SteamFamTrack uses an isolated `steamfam` Postgres schema with RLS enabled and `service_role`-only grants:

```bash
psql "$DATABASE_URL" -f supabase/migrations/001_steamfam_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/002_discord_links.sql
psql "$DATABASE_URL" -f supabase/migrations/003_account_based_families.sql
psql "$DATABASE_URL" -f supabase/migrations/004_discord_links_steam_id64.sql
```

If using Supabase PostgREST, expose the schema in `PGRST_DB_SCHEMAS`:

```env
PGRST_DB_SCHEMAS=public,graphql_public,steamfam
```

### 3. Run Locally & Verify

```bash
npm run dev      # Start Next.js dev server on http://localhost:3000
npm test         # Run unit tests (node --test)
npm run lint     # Run ESLint
npx tsc --noEmit # Type-check
```

For Discord bot setup and deployment, see [`discord-bot/README.md`](./discord-bot/README.md).

---

## Architecture

```text
src/
├── app/
│   ├── api/
│   │   ├── analyze/                 # Rate-limited live Steam Family analysis
│   │   ├── auth/
│   │   │   ├── steam/               # Steam OpenID 2.0 login, callback, logout
│   │   │   ├── discord-activity/    # Discord Activity OAuth2 bridge
│   │   │   └── me/                  # Active session endpoint
│   │   ├── cron/snapshots/          # Bearer-protected automated snapshot runner
│   │   ├── families/                # Private family CRUD & snapshot history
│   │   ├── me/families/             # Current user's active & waitlisted families
│   │   ├── steam/                   # resolve, friends, check, discounts, wishlists
│   │   └── health/                  # Steam API key & Supabase health probe
│   └── f/[slug]/                    # Family route
├── components/                      # Launchpad, Dashboard, Board, Matrix, Swaps,
│                                    # Checker, Leaderboard, History, Themes Studio
└── lib/
    ├── analyzer.ts                  # Contribution math, overlap, cooldowns, fairness, swaps
    ├── leaderboard.ts               # Currency-normalized Power Score & Hall of Fame
    ├── snapshot-periods.ts          # Weekly/monthly ledger aggregation & streaks
    ├── steam.ts                     # Batched IStoreBrowseService + appdetails cache
    ├── steam-auth.ts                # Steam OpenID 2.0 & signed Discord link tokens
    ├── steam-check.ts               # Game checker, discounts & wishlist overlap
    ├── supabase.ts                  # Server-only `steamfam` schema client
    └── themes.ts                    # 8-theme palette registry & zero-FOUC bootstrap
supabase/migrations/                 # 001–004 SQL migrations
discord-bot/                         # Standalone discord.js v14 bot
```

---

## Disclaimer

SteamFamTrack is an independent, open-source community tool and is **not affiliated with, endorsed by, or sponsored by Valve Corporation**. Steam and the Steam logo are trademarks and/or registered trademarks of Valve Corporation in the U.S. and/or other countries. Game data, pricing, and imagery are provided on an "as-is" basis via the Steam Web API.

---

## License

Copyright (C) 2026 BelTeez Studio ([MarioBelTeez](https://github.com/MarioBelTeez))

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** — see the [`LICENSE`](./LICENSE) file for full details.

If you modify and self-host SteamFamTrack (even as a web service without distributing binaries), you must retain attribution and make your modified source code available under AGPL-3.0.
