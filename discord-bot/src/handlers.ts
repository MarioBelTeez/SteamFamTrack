import { createClient } from "@supabase/supabase-js";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import {
  AnalyzeResponse,
  FamilyMemberInput,
  MemberLibrary,
  STEAM_REGIONS,
  SavedFamilyData,
  SteamRegion,
  SwapShareDelta,
  SwapSimulationResult,
  computeSlotCooldown,
  round2,
} from "./types";

const EMBED_COLOR = 0x1b2838; // Steam dark blue
const ACCENT_GREEN = 0x57f287;
const ACCENT_AMBER = 0xfee75c;
const ACCENT_RED = 0xed4245;

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

async function resolveFamilySlug(
  discordUserId: string,
  providedSlug: string | null
): Promise<string | null> {
  if (providedSlug && providedSlug.trim()) {
    return providedSlug.trim().toLowerCase();
  }

  const db = getSupabaseClient();
  if (!db) return null;

  const { data, error } = await db
    .from("discord_links")
    .select("default_family_slug")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (error || !data?.default_family_slug) return null;
  return String(data.default_family_slug).trim().toLowerCase();
}

async function fetchFamilyBySlug(slug: string): Promise<SavedFamilyData> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/families/${encodeURIComponent(slug)}`
  );
  const body = (await res.json()) as SavedFamilyData & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Failed to load family "${slug}" (${res.status})`);
  }
  return body;
}

async function detectAnalyzeMode(): Promise<"live" | "demo"> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/analyze`);
    if (!res.ok) return "demo";
    const data = (await res.json()) as { hasApiKey?: boolean };
    return data.hasApiKey ? "live" : "demo";
  } catch {
    return "demo";
  }
}

async function runAnalyze(family: SavedFamilyData | null): Promise<AnalyzeResponse> {
  const mode = family ? await detectAnalyzeMode() : "demo";
  const payload = family
    ? {
        mode,
        region: family.region,
        members: family.members,
        waitlist: family.waitlist,
      }
    : {
        mode: "demo" as const,
        region: "ma" as SteamRegion,
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
  const steamUrl = interaction.options.getString("steam_url", true).trim();
  const familySlug = interaction.options
    .getString("family_slug", false)
    ?.trim()
    .toLowerCase();

  const db = getSupabaseClient();
  if (!db) {
    await interaction.reply({
      content:
        "Supabase is not configured on this bot (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` missing).",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const { error } = await db.from("discord_links").upsert(
    {
      discord_user_id: interaction.user.id,
      steam_input: steamUrl,
      default_family_slug: familySlug || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "discord_user_id" }
  );

  if (error) {
    await interaction.editReply({
      content: `Failed to save your link: ${error.message}`,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(ACCENT_GREEN)
    .setTitle("Steam Account Linked")
    .addFields(
      { name: "Steam Profile", value: `\`${steamUrl}\``, inline: false },
      {
        name: "Default Family Slug",
        value: familySlug ? `\`${familySlug}\`` : "_None (will use Demo Mode unless slug is provided)_",
        inline: false,
      }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleFamilyBoard(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const providedSlug = interaction.options.getString("slug", false);
  const slug = await resolveFamilySlug(interaction.user.id, providedSlug);
  const family = slug ? await fetchFamilyBySlug(slug) : null;
  const result = await runAnalyze(family);

  const { analysis, mode } = result;
  const symbol = analysis.currencySymbol;
  const regionLabel = STEAM_REGIONS[analysis.region]?.label ?? analysis.region;
  const titleName = family ? family.name : "Demo Steam Family";

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
        value: `${regionLabel}\n${mode === "live" ? "Live Steam" : "Demo Mode"}`,
        inline: true,
      }
    )
    .setFooter({
      text: slug ? `Family slug: ${slug}` : "Demo Mode (pass a slug or /link a default)",
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleFamilyMonthly(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const providedSlug = interaction.options.getString("slug", false);
  const slug = await resolveFamilySlug(interaction.user.id, providedSlug);

  if (!slug) {
    await interaction.editReply({
      content:
        "No family slug provided and no default family linked. Pass `slug` to `/family monthly` or set one with `/link`.",
    });
    return;
  }

  const family = await fetchFamilyBySlug(slug);
  if (!family.snapshots || family.snapshots.length === 0) {
    await interaction.editReply({
      content: `No monthly snapshots have been saved yet for **${family.name}** (\`${slug}\`).`,
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
        ? `Compared against ${prev.snapshotMonth} · slug: ${slug}`
        : `First saved snapshot · slug: ${slug}`,
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
  const providedSlug = interaction.options.getString("slug", false);

  const slug = await resolveFamilySlug(interaction.user.id, providedSlug);
  const family = slug ? await fetchFamilyBySlug(slug) : null;
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
      text: `${family ? family.name : "Demo Family"} · ${
        result.mode === "live" ? "Live Steam" : "Demo Mode"
      }`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleFamilyWaitlist(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const providedSlug = interaction.options.getString("slug", false);
  const slug = await resolveFamilySlug(interaction.user.id, providedSlug);
  const family = slug ? await fetchFamilyBySlug(slug) : null;

  let activeMembers: FamilyMemberInput[];
  let waitlistMembers: FamilyMemberInput[];
  let titleName: string;

  if (family) {
    activeMembers = family.members;
    waitlistMembers = family.waitlist;
    titleName = family.name;
  } else {
    const demo = await runAnalyze(null);
    activeMembers = demo.activeLibraries.map((l) => l.member);
    waitlistMembers = demo.waitlistLibraries.map((l) => l.member);
    titleName = "Demo Steam Family";
  }

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
        name: `Waitlisted Friends (${waitlistMembers.length})`,
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
      text: slug ? `Family slug: ${slug}` : "Demo Mode (pass a slug or /link a default)",
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
