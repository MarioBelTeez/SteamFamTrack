# SteamFamTrack Discord Bot

Standalone Discord bot for **SteamFamTrack** built with `discord.js` v14, `@supabase/supabase-js`, and the SteamFamTrack Next.js API. Supports both **Guild Install** (servers) and **User Install** (DMs and private group chats).

## Commands

| Command | Description |
| --- | --- |
| `/link` | Generates a signed, single-use Steam OpenID 2.0 verification link to securely connect your Discord account to your SteamID64 in `steamfam.discord_links`. |
| `/check <game> [family]` | Checks a Steam game's live regional price, discount %, Family Sharing support (Category `62`), and who in your family already owns it. |
| `/family board [family]` | Displays your Steam Family contribution leaderboard (rank, `%` share, raw value, unique catalog, and Fairness Meter). Auto-detects your linked family if omitted. |
| `/family monthly [family]` | Displays the latest saved monthly snapshot and deltas vs. the previous period. |
| `/family simulate <remove_name> <add_name> [family]` | Simulates swapping an active member with a waitlisted member, showing unique games delta, value delta, `%` share shifts, and 1-year slot cooldown status. |
| `/family waitlist [family]` | Lists waitlisted friends and active members' 1-year slot unlock dates. |

## Prerequisites

1. Apply all Supabase migrations (`001` through `004`) from `supabase/migrations/`.
2. Ensure your SteamFamTrack Next.js app is reachable at `STEAMFAM_API_URL` and shares the same `DISCORD_LINK_SECRET`.
3. Create a Discord Application & Bot in the [Discord Developer Portal](https://discord.com/developers/applications):
   - Copy the **Application ID** (`DISCORD_CLIENT_ID`) and **Bot Token** (`DISCORD_TOKEN`).
   - No privileged gateway intents are required — only `GatewayIntentBits.Guilds` and slash commands (`applications.commands`).
   - Enable both **Guild Install** and **User Install** under *Installation* if you want users to run commands in DMs and private channels.

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
- `STEAMFAM_API_URL` — Base URL of your SteamFamTrack web app (e.g. `https://steamft.com` or `http://localhost:3000`)
- `DISCORD_LINK_SECRET` — Shared HMAC secret matching the web app's `DISCORD_LINK_SECRET`
- `SUPABASE_URL` — Your Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (for `steamfam.discord_links` and family lookups)

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
