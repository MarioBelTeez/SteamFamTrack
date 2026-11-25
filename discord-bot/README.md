# SteamFamTrack Discord Bot (Phase 3)

Standalone Discord bot for **SteamFamTrack** using `discord.js` v14, `@supabase/supabase-js`, and the SteamFamTrack Next.js API.

## Commands

| Command | Description |
| --- | --- |
| `/link <steam_url> [family_slug]` | Links your Discord user ID to your Steam profile and optional default family slug in `steamfam.discord_links`. |
| `/family board [slug]` | Displays the Steam Family contribution leaderboard (Top contributors, `%` share, raw value, unique catalog). Falls back to your linked default slug or Demo Mode. |
| `/family monthly [slug]` | Displays the latest saved monthly snapshot and deltas vs. the previous month. |
| `/family simulate <remove_name> <add_name> [slug]` | Simulates swapping an active member with a waitlisted member, showing unique games delta, value delta, share % shifts, and 1-year slot cooldown status. |
| `/family waitlist [slug]` | Lists waitlisted friends and active members' 1-year slot unlock dates. |

## Prerequisites

1. Run the Supabase migration `supabase/migrations/002_discord_links.sql` on your Supabase instance (after `001_steamfam_schema.sql`).
2. Ensure the SteamFamTrack Next.js app is running and reachable at `STEAMFAM_API_URL` (default `http://localhost:3000`).
3. Create a Discord Application & Bot in the [Discord Developer Portal](https://discord.com/developers/applications):
   - Copy the **Application ID** (`DISCORD_CLIENT_ID`) and **Bot Token** (`DISCORD_TOKEN`).
   - No privileged gateway intents are required — the bot only uses `GatewayIntentBits.Guilds` and slash commands (`applications.commands`).
   - Invite the bot with scopes `bot` + `applications.commands` and permissions `Send Messages` + `Embed Links`.

## Setup & Run

```bash
cd discord-bot
npm install
cp .env.example .env
```

Fill in `.env`:

- `DISCORD_TOKEN` — Bot token
- `DISCORD_CLIENT_ID` — Application client ID
- `DISCORD_GUILD_ID` — *(Optional)* Server ID for instant guild-level command registration during development
- `STEAMFAM_API_URL` — Base URL of your SteamFamTrack Next.js server (default `http://localhost:3000`)
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (required for `steamfam.discord_links`)

Register slash commands:

```bash
npm run register
```

Run in development (watch mode):

```bash
npm run dev
```

Or build and run in production:

```bash
npm run build
npm start
```
