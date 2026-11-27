#!/usr/bin/env node
/**
 * Post a formatted SteamFamTrack release announcement to Discord (#steamft-updates).
 *
 * Usage:
 *   node scripts/announce-release.mjs --version v1.1.0 --title "Trophy Cabinet & /profile Flex Cards" --notes "..."
 *
 * Auth (uses first available):
 *   1. DISCORD_UPDATES_WEBHOOK env var
 *   2. DISCORD_TOKEN + DISCORD_UPDATES_CHANNEL_ID (default: BelTeez Studio #steamft-updates)
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_CHANNEL_ID = "1575576937336934480";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

function readLatestChangelogSection(version) {
  const p = path.resolve(process.cwd(), "CHANGELOG.md");
  if (!fs.existsSync(p)) return "";
  const raw = fs.readFileSync(p, "utf8");
  const cleanVer = version.replace(/^v/i, "");
  const headerRe = new RegExp(`^##\\s+\\[v?${cleanVer.replace(/\./g, "\\.")}\\].*$`, "m");
  const match = raw.match(headerRe);
  if (!match || match.index === undefined) return "";
  const after = raw.slice(match.index + match[0].length);
  const nextIdx = after.search(/^##\s+\[/m);
  return (nextIdx >= 0 ? after.slice(0, nextIdx) : after).trim();
}

const args = parseArgs(process.argv.slice(2));
const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"));
const version = args.version || `v${pkg.version}`;
const title = args.title
  ? `${args.title} (${version})`
  : `SteamFamTrack ${version}`;
const notes = (args.notes || readLatestChangelogSection(version) || "New update live on https://steamft.com").slice(0, 3800);
const releaseUrl = args.url || `https://github.com/MarioBelTeez/SteamFamTrack/releases/tag/${version}`;

const embed = {
  title: `🚀 ${title}`,
  url: releaseUrl,
  color: 0xe8002d,
  description: notes,
  footer: { text: `steamft.com · ${version} · BelTeez Studio` },
  timestamp: new Date().toISOString(),
};

const webhookUrl = process.env.DISCORD_UPDATES_WEBHOOK?.trim();
const botToken = process.env.DISCORD_TOKEN?.trim();
const channelId = process.env.DISCORD_UPDATES_CHANNEL_ID?.trim() || DEFAULT_CHANNEL_ID;

if (args["dry-run"] === "true") {
  console.log(JSON.stringify({ channelId, embed }, null, 2));
  process.exit(0);
}

if (webhookUrl) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) {
    console.error("Webhook failed:", res.status, await res.text());
    process.exit(1);
  }
  console.log(`Posted ${version} announcement via webhook.`);
} else if (botToken) {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) {
    console.error("Channel post failed:", res.status, await res.text());
    process.exit(1);
  }
  const msg = await res.json();
  console.log(`Posted ${version} announcement to channel ${channelId} (message ${msg.id}).`);
} else {
  console.error("Set DISCORD_UPDATES_WEBHOOK or DISCORD_TOKEN to post.");
  process.exit(1);
}
