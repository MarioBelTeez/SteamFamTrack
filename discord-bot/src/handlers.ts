import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import {
  AnalyzeResponse,
  MemberLibrary,
  STEAM_REGIONS,
  SavedFamilyData,
  SwapShareDelta,
  SwapSimulationResult,
  computeSlotCooldown,
  round2,
} from "./types";

const EMBED_COLOR = 0xe8002d; // BelTeez Crimson
const ACCENT_GREEN = 0x57f287;
const ACCENT_AMBER = 0xfee75c;
const ACCENT_RED = 0xed4245;

const LINK_REQUIRED_MESSAGE =
  "Verify and link your Steam account first with `/link` (must match a Steam account saved in a SteamFamTrack family).";

const DISCORD_LINK_TTL_MS = 10 * 60 * 1000;

function signDiscordLinkToken(discordUserId: string): string | null {
  const secret =
    process.env.DISCORD_LINK_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) return null;

  const payloadB64 = Buffer.from(
    JSON.stringify({
      discordUserId,
      exp: Date.now() + DISCORD_LINK_TTL_MS,
    }),
    "utf8"
  ).toString("base64url");

  const sigB64 = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${sigB64}`;
}

function getApiBaseUrl(): string {
  const raw =
    process.env.STEAMFAM_API_URL?.trim() ||
    process.env.STEAFAM_API_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;

  return createClient(url, key, {
    db: { schema: "steamfam" },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function resolveFamilyForDiscordUser(
  discordUserId: string,
  familyFilter: string | null
): Promise<SavedFamilyData | string> {
  const db = getSupabaseClient();
  if (!db) {
    return "Supabase is not configured on this bot (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing).";
  }

  const { data: linkRow, error: linkErr } = await db
    .from("discord_links")
    .select("steam_id64, steam_input")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (linkErr) {
    return `Failed to read Discord link: ${linkErr.message}`;
  }

  const steamId64 = linkRow?.steam_id64 ? String(linkRow.steam_id64) : null;
  if (!steamId64) {
    return LINK_REQUIRED_MESSAGE;
  }

  const [{ data: ownedRows }, { data: memberRows }] = await Promise.all([
    db
      .from("families")
      .select("id, slug, name, region, created_at, updated_at")
      .eq("owner_steam_id64", steamId64),
    db
      .from("family_members")
      .select("family_id, is_waitlist")
      .eq("steam_id64", steamId64),
  ]);

  const candidateIds: string[] = [];
  for (const r of ownedRows ?? []) {
    if (r.id && !candidateIds.includes(r.id)) candidateIds.push(r.id);
  }
  for (const m of memberRows ?? []) {
    if (!m.is_waitlist && m.family_id && !candidateIds.includes(m.family_id)) {
      candidateIds.push(m.family_id);
    }
  }
  for (const m of memberRows ?? []) {
    if (m.is_waitlist && m.family_id && !candidateIds.includes(m.family_id)) {
      candidateIds.push(m.family_id);
    }
  }

  if (candidateIds.length === 0) {
    return `Your linked Steam account (\`${steamId64}\`) isn't in any saved SteamFamTrack family yet. Sign in at ${getApiBaseUrl()} and save your family first.`;
  }

  const { data: families } = await db
    .from("families")
    .select("id, slug, name, region, created_at, updated_at")
    .in("id", candidateIds);

  if (!families || families.length === 0) {
    return "No accessible SteamFamTrack family found for your Steam account.";
  }

  let chosen = families.find((f) => f.id === candidateIds[0]) ?? families[0];
  if (familyFilter && familyFilter.trim()) {
    const q = familyFilter.trim().toLowerCase();
    const matched = families.find(
      (f) => f.slug.toLowerCase() === q || f.name.toLowerCase().includes(q)
    );
    if (!matched) {
      const names = families.map((f) => `\`${f.name}\``).join(", ");
      return `Could not find a family matching "${familyFilter}". Accessible families: ${names}`;
    }
    chosen = matched;
  }

  const [{ data: members }, { data: snapshots }] = await Promise.all([
    db
      .from("family_members")
      .select("id, display_name, steam_input, join_date, is_waitlist, position")
      .eq("family_id", chosen.id)
      .order("position", { ascending: true }),
    db
      .from("monthly_snapshots")
      .select(
        "id, snapshot_month, region, unique_games_count, unique_catalog_value, sum_copies_count, sum_copies_value, member_breakdown, created_at"
      )
      .eq("family_id", chosen.id)
      .order("snapshot_month", { ascending: false }),
  ]);

  const mappedMembers = (members ?? []).map((r) => ({
    id: r.id,
    name: r.display_name,
    steamUrlOrId: r.steam_input,
    joinDate: r.join_date ?? undefined,
    isWaitlist: Boolean(r.is_waitlist),
  }));

  return {
    id: chosen.id,
    slug: chosen.slug,
    name: chosen.name,
    region: chosen.region,
    members: mappedMembers.filter((m) => !m.isWaitlist),
    waitlist: mappedMembers.filter((m) => m.isWaitlist),
    snapshots: (snapshots ?? []).map((s) => ({
      id: s.id,
      snapshotMonth: s.snapshot_month,
      region: s.region,
      uniqueGamesCount: Number(s.unique_games_count),
      uniqueCatalogValue: Number(s.unique_catalog_value),
      sumCopiesCount: Number(s.sum_copies_count),
      sumCopiesValue: Number(s.sum_copies_value),
      memberBreakdown: Array.isArray(s.member_breakdown)
        ? s.member_breakdown
        : [],
      createdAt: s.created_at,
    })),
    createdAt: chosen.created_at,
    updatedAt: chosen.updated_at,
  };
}

async function runAnalyze(family: SavedFamilyData): Promise<AnalyzeResponse> {
  const payload = {
    mode: "live" as const,
    region: family.region,
    members: family.members,
    waitlist: family.waitlist,
  };

  const res = await fetch(`${getApiBaseUrl()}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await res.json()) as AnalyzeResponse & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Analyze request failed (${res.status})`);
  }
  return body;
}

function formatMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSignedInt(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

function formatSignedMoney(delta: number, symbol: string): string {
  const abs = Math.abs(delta).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return delta >= 0 ? `+${symbol}${abs}` : `-${symbol}${abs}`;
}

function formatCooldownLine(joinDate?: string): string {
  const cd = computeSlotCooldown(joinDate);
  if (!cd.joinDate) return "⚪ Join date not set";
  if (cd.isSlotUnlocked) {
    return `✅ Unlocked (joined ${cd.joinDate}, unlocked ${cd.slotUnlockDate})`;
  }
  return `🔒 Unlocks ${cd.slotUnlockDate} (${cd.daysUntilUnlock}d left · joined ${cd.joinDate})`;
}

function findMemberLibrary(
  libraries: MemberLibrary[],
  query: string
): MemberLibrary | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const exact = libraries.find(
    (l) =>
      l.member.name.trim().toLowerCase() === q ||
      l.personaName.trim().toLowerCase() === q
  );
  if (exact) return exact;

  const partial = libraries.find(
    (l) =>
      l.member.name.toLowerCase().includes(q) ||
      l.personaName.toLowerCase().includes(q)
  );
  return partial ?? null;
}

function computeCatalogStats(libraries: MemberLibrary[]): {
  uniqueGamesCount: number;
  uniqueCatalogValue: number;
  memberShares: Map<string, { name: string; sharePercent: number }>;
} {
  const uniqueGames = new Map<number, number>();
  let sumCopiesValue = 0;
  const memberValues: Array<{ id: string; name: string; value: number }> = [];

  for (const lib of libraries) {
    let memberTotal = 0;
    const seen = new Set<number>();
    for (const game of lib.games) {
      if (game.familySharingExcluded || seen.has(game.appid)) continue;
      seen.add(game.appid);
      memberTotal += game.rawPrice;
      if (!uniqueGames.has(game.appid)) {
        uniqueGames.set(game.appid, game.rawPrice);
      }
    }
    sumCopiesValue += memberTotal;
    memberValues.push({
      id: lib.member.id,
      name: lib.member.name,
      value: round2(memberTotal),
    });
  }

  let uniqueCatalogValue = 0;
  for (const price of uniqueGames.values()) {
    uniqueCatalogValue += price;
  }

  const memberShares = new Map<string, { name: string; sharePercent: number }>();
  for (const m of memberValues) {
    memberShares.set(m.id, {
      name: m.name,
      sharePercent:
        sumCopiesValue > 0 ? round2((m.value / sumCopiesValue) * 100) : 0,
    });
  }

  return {
    uniqueGamesCount: uniqueGames.size,
    uniqueCatalogValue: round2(uniqueCatalogValue),
    memberShares,
  };
}

function simulateSwapFromLibraries(
  activeLibraries: MemberLibrary[],
  target: MemberLibrary,
  candidate: MemberLibrary
): SwapSimulationResult {
  const before = computeCatalogStats(activeLibraries);
  const nextLibraries = activeLibraries
    .filter((l) => l.member.id !== target.member.id)
    .concat(candidate);
  const after = computeCatalogStats(nextLibraries);

  const allIds = new Set([
    ...before.memberShares.keys(),
    ...after.memberShares.keys(),
  ]);
  const shareDeltas: SwapShareDelta[] = [];

  for (const id of allIds) {
    const b = before.memberShares.get(id);
    const a = after.memberShares.get(id);
    const beforePct = b?.sharePercent ?? 0;
    const afterPct = a?.sharePercent ?? 0;
    shareDeltas.push({
      memberId: id,
      name: a?.name ?? b?.name ?? id,
      beforePct,
      afterPct,
      deltaPct: round2(afterPct - beforePct),
    });
  }

  shareDeltas.sort((a, b) => b.afterPct - a.afterPct);

  return {
    removedMemberName: target.member.name,
    addedMemberName: candidate.member.name,
    removedSlotCooldown: computeSlotCooldown(target.member.joinDate),
    beforeUniqueGames: before.uniqueGamesCount,
    afterUniqueGames: after.uniqueGamesCount,
    uniqueGamesDelta: after.uniqueGamesCount - before.uniqueGamesCount,
    beforeUniqueValue: before.uniqueCatalogValue,
    afterUniqueValue: after.uniqueCatalogValue,
    uniqueValueDelta: round2(
      after.uniqueCatalogValue - before.uniqueCatalogValue
    ),
    shareDeltas,
  };
}

export async function handleInteraction(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (interaction.commandName === "link") {
    await handleLink(interaction);
    return;
  }

  if (interaction.commandName === "check") {
    await handleCheck(interaction);
    return;
  }

  if (interaction.commandName === "kos") {
    await handleKos(interaction);
    return;
  }

  if (interaction.commandName === "family") {
    const sub = interaction.options.getSubcommand();
    if (sub === "board") {
      await handleFamilyBoard(interaction);
    } else if (sub === "monthly") {
      await handleFamilyMonthly(interaction);
    } else if (sub === "simulate") {
      await handleFamilySimulate(interaction);
    } else if (sub === "waitlist") {
      await handleFamilyWaitlist(interaction);
    }
  }
}

async function handleLink(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const token = signDiscordLinkToken(interaction.user.id);
  if (!token) {
    await interaction.reply({
      content:
        "Discord link signing is not configured on this bot (`SUPABASE_SERVICE_ROLE_KEY` or `DISCORD_LINK_SECRET` missing).",
      ephemeral: true,
    });
    return;
  }

  const verifyUrl = `${getApiBaseUrl()}/api/auth/steam?discord_link=${encodeURIComponent(
    token
  )}`;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle("Verify Your Steam Account")
    .setDescription(
      "Click the button below to sign in through **Steam's official OpenID login**.\n\n" +
        "• Proves you own your Steam account (prevents anyone else from linking it)\n" +
        "• Never asks for or shares your Steam password\n" +
        "• Link expires in **10 minutes**"
    )
    .setFooter({ text: "After signing in, run /family board in Discord!" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Sign in with Steam")
      .setStyle(ButtonStyle.Link)
      .setURL(verifyUrl)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

async function handleFamilyBoard(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const familyFilter = interaction.options.getString("family", false);
  const family = await resolveFamilyForDiscordUser(
    interaction.user.id,
    familyFilter
  );

  if (typeof family === "string") {
    await interaction.editReply({ content: family });
    return;
  }

  const result = await runAnalyze(family);

  const { analysis } = result;
  const symbol = analysis.currencySymbol;
  const regionLabel = STEAM_REGIONS[analysis.region]?.label ?? analysis.region;
  const titleName = family.name;

  const leaderboardLines = analysis.members.map((m, idx) => {
    const medal =
      idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `**#${idx + 1}**`;
    return `${medal} **${m.name}** — **${m.sharePercent.toFixed(1)}%** · ${formatMoney(
      m.totalRawValue,
      symbol
    )} (${m.totalGames} games, ${m.exclusiveGames} exclusive)`;
  });

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`🎮 ${titleName} — Family Leaderboard`)
    .setDescription(
      leaderboardLines.length > 0
        ? leaderboardLines.join("\n")
        : "No active members found."
    )
    .addFields(
      {
        name: "Unique Catalog",
        value: `${analysis.uniqueGamesCount} games\n${formatMoney(
          analysis.uniqueCatalogValue,
          symbol
        )}`,
        inline: true,
      },
      {
        name: "Total Copies",
        value: `${analysis.sumCopiesCount} copies\n${formatMoney(
          analysis.sumCopiesValue,
          symbol
        )}`,
        inline: true,
      },
      {
        name: "Region / Mode",
        value: `${regionLabel}\nLive Steam`,
        inline: true,
      }
    )
    .setFooter({
      text: `${family.name} · Live Steam`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleFamilyMonthly(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const familyFilter = interaction.options.getString("family", false);
  const family = await resolveFamilyForDiscordUser(
    interaction.user.id,
    familyFilter
  );

  if (typeof family === "string") {
    await interaction.editReply({ content: family });
    return;
  }

  if (!family.snapshots || family.snapshots.length === 0) {
    await interaction.editReply({
      content: `No monthly snapshots have been saved yet for **${family.name}**.`,
    });
    return;
  }

  const latest = family.snapshots[0];
  const prev = family.snapshots[1] ?? null;
  const symbol = STEAM_REGIONS[latest.region]?.symbol ?? "$";

  const gamesDeltaStr = prev
    ? ` (${formatSignedInt(latest.uniqueGamesCount - prev.uniqueGamesCount)} vs ${prev.snapshotMonth})`
    : "";
  const valueDeltaStr = prev
    ? ` (${formatSignedMoney(
        round2(latest.uniqueCatalogValue - prev.uniqueCatalogValue),
        symbol
      )} vs ${prev.snapshotMonth})`
    : "";
  const copiesDeltaStr = prev
    ? ` (${formatSignedInt(latest.sumCopiesCount - prev.sumCopiesCount)} vs ${prev.snapshotMonth})`
    : "";

  const breakdownLines = latest.memberBreakdown
    .slice(0, 6)
    .map(
      (m, idx) =>
        `**#${idx + 1}** ${m.name} — **${m.sharePercent.toFixed(1)}%** · ${formatMoney(
          m.totalRawValue,
          symbol
        )} (${m.totalGames} games, ${m.exclusiveGames} excl.)`
    );

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`📅 ${family.name} — Monthly Snapshot (${latest.snapshotMonth})`)
    .addFields(
      {
        name: "Unique Games",
        value: `${latest.uniqueGamesCount}${gamesDeltaStr}`,
        inline: true,
      },
      {
        name: "Unique Catalog Value",
        value: `${formatMoney(latest.uniqueCatalogValue, symbol)}${valueDeltaStr}`,
        inline: true,
      },
      {
        name: "Total Copies",
        value: `${latest.sumCopiesCount}${copiesDeltaStr}`,
        inline: true,
      },
      {
        name: "Member Breakdown",
        value:
          breakdownLines.length > 0
            ? breakdownLines.join("\n")
            : "_No member breakdown recorded._",
        inline: false,
      }
    )
    .setFooter({
      text: prev
        ? `Compared against ${prev.snapshotMonth} · ${family.name}`
        : `First saved snapshot · ${family.name}`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleFamilySimulate(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const removeName = interaction.options.getString("remove_name", true);
  const addName = interaction.options.getString("add_name", true);
  const familyFilter = interaction.options.getString("family", false);

  const family = await resolveFamilyForDiscordUser(
    interaction.user.id,
    familyFilter
  );

  if (typeof family === "string") {
    await interaction.editReply({ content: family });
    return;
  }

  const result = await runAnalyze(family);

  const target = findMemberLibrary(result.activeLibraries, removeName);
  if (!target) {
    const available =
      result.activeLibraries.map((m) => `\`${m.member.name}\``).join(", ") ||
      "_none_";
    await interaction.editReply({
      content: `Could not find active member matching **${removeName}**.\nAvailable active members: ${available}`,
    });
    return;
  }

  const candidate = findMemberLibrary(result.waitlistLibraries, addName);
  if (!candidate) {
    const available =
      result.waitlistLibraries.map((m) => `\`${m.member.name}\``).join(", ") ||
      "_none_";
    await interaction.editReply({
      content: `Could not find waitlisted member matching **${addName}**.\nAvailable waitlisted members: ${available}`,
    });
    return;
  }

  const sim = simulateSwapFromLibraries(
    result.activeLibraries,
    target,
    candidate
  );
  const symbol = result.analysis.currencySymbol;
  const cd = sim.removedSlotCooldown;

  let cooldownText = "⚪ No join date recorded (assumed unlocked)";
  if (cd.joinDate) {
    cooldownText = cd.isSlotUnlocked
      ? `✅ **Unlocked** (joined ${cd.joinDate}, unlocked ${cd.slotUnlockDate})`
      : `🔒 **Locked** until **${cd.slotUnlockDate}** (${cd.daysUntilUnlock} days remaining; joined ${cd.joinDate})`;
  }

  const shareLines = sim.shareDeltas.slice(0, 7).map((s) => {
    const sign = s.deltaPct >= 0 ? "+" : "";
    return `• **${s.name}**: ${s.beforePct.toFixed(1)}% → ${s.afterPct.toFixed(
      1
    )}% (${sign}${s.deltaPct.toFixed(1)}%)`;
  });

  const color =
    sim.uniqueValueDelta > 0
      ? ACCENT_GREEN
      : sim.uniqueValueDelta < 0
      ? ACCENT_RED
      : ACCENT_AMBER;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔄 Swap Simulation: ${sim.removedMemberName} → ${sim.addedMemberName}`)
    .addFields(
      {
        name: "Unique Games Delta",
        value: `${sim.beforeUniqueGames} → ${sim.afterUniqueGames} (**${formatSignedInt(
          sim.uniqueGamesDelta
        )}**)`,
        inline: true,
      },
      {
        name: "Catalog Value Delta",
        value: `${formatMoney(sim.beforeUniqueValue, symbol)} → ${formatMoney(
          sim.afterUniqueValue,
          symbol
        )} (**${formatSignedMoney(sim.uniqueValueDelta, symbol)}**)`,
        inline: true,
      },
      {
        name: `1-Year Slot Cooldown (${sim.removedMemberName})`,
        value: cooldownText,
        inline: false,
      },
      {
        name: "Share % Impact",
        value: shareLines.join("\n") || "_No share data_",
        inline: false,
      }
    )
    .setFooter({
      text: `${family.name} · Live Steam`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleFamilyWaitlist(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const familyFilter = interaction.options.getString("family", false);
  const family = await resolveFamilyForDiscordUser(
    interaction.user.id,
    familyFilter
  );

  if (typeof family === "string") {
    await interaction.editReply({ content: family });
    return;
  }

  const activeMembers = family.members;
  const waitlistMembers = family.waitlist;
  const titleName = family.name;

  const activeLines = activeMembers.map(
    (m, idx) => `**${idx + 1}. ${m.name}** — ${formatCooldownLine(m.joinDate)}`
  );
  const waitlistLines = waitlistMembers.map(
    (w, idx) => `**${idx + 1}. ${w.name}** (\`${w.steamUrlOrId}\`)`
  );

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`⏳ ${titleName} — Waitlist & 1-Year Slot Cooldowns`)
    .addFields(
      {
        name: `Waitlisted Friends (${waitlistMembers.length}/6)`,
        value:
          waitlistLines.length > 0
            ? waitlistLines.join("\n")
            : "_No waitlisted friends._",
        inline: false,
      },
      {
        name: `Active Slots (${activeMembers.length}/6)`,
        value:
          activeLines.length > 0
            ? activeLines.join("\n")
            : "_No active members._",
        inline: false,
      }
    )
    .setFooter({
      text: `${family.name} · Live Steam`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}


interface SteamCheckApiResponse {
  appid: number;
  name: string;
  headerImage: string;
  storeUrl: string;
  region: string;
  isFree: boolean;
  familySharingSupported: boolean;
  familySharingNote: string;
  priceOverview: {
    currency: string;
    initial: number;
    final: number;
    discountPercent: number;
    initialFormatted: string;
    finalFormatted: string;
  } | null;
  error?: string;
}

async function handleCheck(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const gameQuery = interaction.options.getString("game", true).trim();
  const familyFilter = interaction.options.getString("family", false);

  const familyOrMsg = await resolveFamilyForDiscordUser(
    interaction.user.id,
    familyFilter
  );
  const family = typeof familyOrMsg === "string" ? null : familyOrMsg;
  const region = family?.region ?? "us";

  const checkRes = await fetch(`${getApiBaseUrl()}/api/steam/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: gameQuery, region }),
  });
  const game = (await checkRes.json()) as SteamCheckApiResponse;

  if (!checkRes.ok || !game.appid) {
    await interaction.editReply({
      content: game.error || `No Steam game found matching "${gameQuery}".`,
    });
    return;
  }

  let ownershipText =
    "_Link your Steam account with `/link` to see who in your family owns this._";

  if (family) {
    const analyzed = await runAnalyze(family);
    const activeOwners = analyzed.activeLibraries.filter((lib) =>
      lib.games.some((g) => g.appid === game.appid)
    );
    const waitlistOwners = analyzed.waitlistLibraries.filter((lib) =>
      lib.games.some((g) => g.appid === game.appid)
    );

    if (activeOwners.length > 0) {
      const names = activeOwners
        .map((o) => `**${o.personaName || o.member.name}**`)
        .join(", ");
      ownershipText = game.familySharingSupported
        ? `✅ Already owned in **${family.name}** by ${names}`
        : `⚠️ Owned by ${names}, but **Family Sharing is disabled**`;
    } else {
      ownershipText = `🆕 Nobody in **${family.name}** owns this yet.`;
    }

    if (waitlistOwners.length > 0) {
      const wNames = waitlistOwners
        .map((o) => o.personaName || o.member.name)
        .join(", ");
      ownershipText += `\nWaitlist owners: ${wNames}`;
    }
  }

  let priceText = "Unavailable";
  if (game.isFree) {
    priceText = "Free to Play";
  } else if (game.priceOverview) {
    priceText =
      game.priceOverview.discountPercent > 0
        ? `🏷️ **-${game.priceOverview.discountPercent}%** → **${game.priceOverview.finalFormatted}** ~~${game.priceOverview.initialFormatted}~~`
        : `**${game.priceOverview.finalFormatted}**`;
  }

  const sharingText = game.isFree
    ? "🟢 Free to Play"
    : game.familySharingSupported
      ? "✅ Family Sharing Supported"
      : "🚫 Opted Out of Family Sharing";

  const embed = new EmbedBuilder()
    .setColor(
      game.isFree || game.familySharingSupported ? EMBED_COLOR : ACCENT_RED
    )
    .setTitle(`🛒 ${game.name}`)
    .setURL(game.storeUrl)
    .setThumbnail(game.headerImage)
    .addFields(
      {
        name: `Price (${region.toUpperCase()})`,
        value: priceText,
        inline: true,
      },
      {
        name: "Family Sharing",
        value: sharingText,
        inline: true,
      },
      {
        name: "Family Ownership",
        value: ownershipText,
        inline: false,
      }
    )
    .setFooter({ text: `AppID ${game.appid} · SteamFamTrack` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleKos(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const familyFilter = interaction.options.getString("family", false);
  const familyOrMsg = await resolveFamilyForDiscordUser(
    interaction.user.id,
    familyFilter
  );

  if (typeof familyOrMsg === "string") {
    await interaction.editReply({ content: familyOrMsg });
    return;
  }

  const family = familyOrMsg;
  const analyzed = await runAnalyze(family);
  const members = analyzed.analysis.members;

  if (!members || members.length === 0) {
    await interaction.editReply({
      content: `No active members found in **${family.name}**.`,
    });
    return;
  }

  const sym = analyzed.analysis.currencySymbol || "$";
  const totalValue = members.reduce((sum, m) => sum + m.totalRawValue, 0);
  const groupAvg = totalValue / members.length;
  const equalTargetPct = 100 / members.length;

  // Target = lowest contributor by raw value (tie-break: lowest game count)
  const target = [...members].sort(
    (a, b) => a.totalRawValue - b.totalRawValue || a.totalGames - b.totalGames
  )[0];

  const deltaVsAvg = target.totalRawValue - groupAvg;
  const displayName = target.personaName || target.name;
  const deltaStr = formatSignedMoney(deltaVsAvg, sym);
  const shareStr = `${target.sharePercent.toFixed(1)}%`;
  const targetPctStr = `${equalTargetPct.toFixed(1)}%`;
  const avgStr = formatMoney(groupAvg, sym);

  const ogUrl = new URL(`${getApiBaseUrl()}/api/og/kos`);
  ogUrl.searchParams.set("name", displayName);
  ogUrl.searchParams.set("delta", deltaStr);
  ogUrl.searchParams.set("share", shareStr);
  ogUrl.searchParams.set("target", targetPctStr);
  ogUrl.searchParams.set("avg", avgStr);
  ogUrl.searchParams.set("family", family.name);
  if (target.avatarUrl) {
    ogUrl.searchParams.set("avatar", target.avatarUrl);
  }

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`🎯 KILL ON SIGHT // ${displayName.toUpperCase()}`)
    .setDescription(
      `**${displayName}** is **${deltaStr} vs. group average** (${shareStr} of ${targetPctStr} target) in **${family.name}**.\nTime to open the wallet.`
    )
    .setFooter({ text: `steamft.com · ${family.name}` })
    .setTimestamp();

  try {
    const imgRes = await fetch(ogUrl.toString(), {
      signal: AbortSignal.timeout(12000),
    });
    if (imgRes.ok) {
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const attachment = new AttachmentBuilder(buf, { name: "kos-target.png" });
      embed.setImage("attachment://kos-target.png");
      await interaction.editReply({ embeds: [embed], files: [attachment] });
      return;
    }
  } catch (err) {
    console.error("Failed to fetch /api/og/kos image:", err);
  }

  // Fallback if image render is transiently unavailable
  if (target.avatarUrl) {
    embed.setThumbnail(target.avatarUrl);
  }
  await interaction.editReply({ embeds: [embed] });
}
