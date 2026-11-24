# SteamFamTrack

A full-stack **Steam Family Contribution & Swap Analyzer** built with Next.js, TypeScript, and Tailwind CSS.

SteamDB tracks individual accounts, and Steam itself provides no contribution breakdown, overlap matrix, or swap/cooldown tooling for Steam Families. **SteamFamTrack** solves that for friend groups sharing up to 6 Steam Family slots.

## Features

- **Contribution Leaderboard:** Ranks members by raw (non-discounted) regional store value (`cc=ma` MENA-USD, `us`, `eu`, `gb`, `br`, `jp`), showing Total Games, Exclusive Games, Shared Games, Exclusive Value, and `% Share`.
- **Family-Sharing Exclusion Filter:** Automatically detects and filters paid titles whose publisher opted out of Steam Family Sharing (missing Steam Store category `62`).
- **N × N Overlap Matrix & Shared Catalog:** Visualizes shared games between every pair of members plus a searchable, filterable deduplicated catalog.
- **1-Year Slot Cooldown Tracking:** Computes each member's **Slot Unlock Date** (`join_date + 1 year`) per Steam Families' cooldown rules.
- **Waitlist & Swap Simulator:** Preview how unique catalog size, catalog value, and every member's `%` share change when swapping an active member with a waitlisted friend.
- **Demo Mode + Live Steam API:** Works out of the box with a 6-member + 2-waitlist sample family, or switch to **Live API** with a `STEAM_API_KEY`.

## Getting Started

```bash
npm install
cp .env.example .env.local
# Optional: add your STEAM_API_KEY in .env.local for live Steam profile lookups
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- `src/lib/analyzer.ts` — Pure contribution math, `N × N` overlap matrix, 1-year cooldown calculator, and swap simulator.
- `src/lib/steam.ts` — Steam Web API (`ResolveVanityURL`, `GetPlayerSummaries`, `GetOwnedGames`) + cached Steam Store `appdetails` client.
- `src/lib/demo-data.ts` — Multi-region sample family dataset for instant zero-config demos.
- `src/app/api/analyze/route.ts` — Server route handling both Demo and Live Steam API analysis.

## Roadmap

- [ ] **Phase 2:** Supabase persistence for saved family groups & monthly snapshot diffs
- [ ] **Phase 3:** Discord Bot & Discord Activity (`/link`, `/family board`, `/family simulate`, `/family waitlist`)
