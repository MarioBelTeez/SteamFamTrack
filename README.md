# SteamFamTrack

A full-stack **Steam Family Contribution, Snapshot & Swap Analyzer** built with Next.js, TypeScript, Tailwind CSS, and Supabase (compatible with self-hosted Supabase or Supabase Cloud).

SteamDB tracks individual accounts, and Steam itself provides no contribution breakdown, overlap matrix, monthly history, or swap/cooldown tooling for Steam Families. **SteamFamTrack** solves that for any friend group sharing up to 6 Steam Family slots.

## Features

- **Contribution Leaderboard:** Ranks members by raw (non-discounted) regional store value (`cc=ma` MENA-USD, `us`, `eu`, `gb`, `br`, `jp`), showing Total Games, Exclusive Games, Shared Games, Exclusive Value, and `% Share`.
- **Family-Sharing Exclusion Filter:** Automatically detects and filters paid titles whose publisher opted out of Steam Family Sharing (missing Steam Store category `62`).
- **N × N Overlap Matrix & Shared Catalog:** Visualizes shared games between every pair of members plus a searchable, filterable deduplicated catalog.
- **1-Year Slot Cooldown Tracking:** Computes each member's **Slot Unlock Date** (`join_date + 1 year`) per Steam Families' cooldown rules.
- **Fairness Meter ("Up Next to Contribute"):** Compares each member's contribution against the group average and highlights who is up next to add a game.
- **Waitlist & Swap Simulator:** Preview how unique catalog size, catalog value, and every member's `%` share change when swapping an active member with a waitlisted friend.
- **Shareable Saved Groups (`/f/<slug>`):** Save any family to get a permanent shareable URL protected by an `scrypt`-hashed edit passcode.
- **Monthly Snapshots & Deltas:** Record monthly snapshots (`YYYY-MM`) to diff new games, regional value added, and per-member `%` share shifts over time.
- **Persistent Price Cache + Rate Limiting:** Caches Steam Store `appdetails` prices in `steamfam.app_price_cache` (7-day TTL) and rate-limits live lookups to protect Steam API quota across public users.
- **Demo Mode + Live Steam API:** Works out of the box with a 6-member + 2-waitlist sample family, or switch to **Live API** with a `STEAM_API_KEY`.
- **Discord Bot (`discord-bot/`):** Slash commands (`/link`, `/family board`, `/family monthly`, `/family simulate`, `/family waitlist`) backed by the same API and `steamfam.discord_links` table.

## Getting Started

```bash
npm install
cp .env.example .env.local
# Optional: set STEAM_API_KEY and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

Apply the database schema (isolated `steamfam` schema with RLS enabled and `service_role`-only grants):

```bash
psql "$DATABASE_URL" -f supabase/migrations/001_steamfam_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/002_discord_links.sql
```

If using Supabase PostgREST, include `steamfam` in `PGRST_DB_SCHEMAS` (e.g. `PGRST_DB_SCHEMAS=public,graphql_public,steamfam`).

Run tests:

```bash
npm test
```

## Architecture

- `src/lib/analyzer.ts` — Pure contribution math, `N × N` overlap matrix, 1-year cooldown calculator, Fairness Meter, and swap simulator.
- `src/lib/analyzer.test.ts` — Unit tests for cooldowns, family analysis, fairness, and swap simulation (`node --test`).
- `src/lib/steam.ts` — Steam Web API (`ResolveVanityURL`, `GetPlayerSummaries`, `GetOwnedGames`) + two-tier cached Steam Store `appdetails` client (in-memory + Postgres `steamfam.app_price_cache`).
- `src/lib/supabase.ts` — Server-only Supabase client scoped to the isolated `steamfam` schema + `scrypt` edit-passcode hashing.
- `src/app/api/analyze/route.ts` — Rate-limited analysis endpoint for Demo and Live Steam API modes.
- `src/app/api/families/` — CRUD + monthly snapshot endpoints for shareable `/f/<slug>` groups.
- `supabase/migrations/` — Isolated `steamfam` schema migrations (`001_steamfam_schema.sql`, `002_discord_links.sql`).
- `discord-bot/` — Standalone TypeScript Discord bot (`discord.js` v14); see `discord-bot/README.md` for setup.

## Roadmap

- [x] **Phase 1:** Contribution board, overlap matrix, Family-Sharing filter, 1-year cooldowns, swap simulator, Fairness Meter
- [x] **Phase 2:** Self-hosted Supabase persistence (`steamfam` schema), shareable `/f/<slug>` groups, DB price cache, monthly snapshots & deltas, rate limiting
- [x] **Phase 3:** Discord Bot (`/link`, `/family board`, `/family monthly`, `/family simulate`, `/family waitlist`)
