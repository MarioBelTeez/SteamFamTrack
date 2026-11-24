import {
  CatalogEntry,
  FamilyAnalysis,
  MemberContribution,
  MemberLibrary,
  STEAM_REGIONS,
  SlotCooldownStatus,
  SteamRegion,
  SwapShareDelta,
  SwapSimulationResult,
} from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Computes Steam Families' 1-year-from-join-date slot & user cooldown.
 * When a member leaves, their slot is locked for 1 year from when they originally joined.
 */
export function computeSlotCooldown(
  joinDate?: string,
  now: Date = new Date()
): SlotCooldownStatus {
  if (!joinDate) {
    return {
      joinDate: null,
      slotUnlockDate: null,
      isSlotUnlocked: true,
      daysUntilUnlock: null,
    };
  }

  const parsed = new Date(`${joinDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return {
      joinDate: null,
      slotUnlockDate: null,
      isSlotUnlocked: true,
      daysUntilUnlock: null,
    };
  }

  const unlock = new Date(parsed);
  unlock.setUTCFullYear(unlock.getUTCFullYear() + 1);

  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const diffDays = Math.ceil((unlock.getTime() - todayUtc) / MS_PER_DAY);

  return {
    joinDate,
    slotUnlockDate: unlock.toISOString().slice(0, 10),
    isSlotUnlocked: diffDays <= 0,
    daysUntilUnlock: diffDays > 0 ? diffDays : 0,
  };
}

/**
 * Analyzes a Steam Family's combined game libraries:
 * - Unique vs. duplicated catalog size and raw regional value
 * - Per-member total, exclusive, shared counts & % share of contributions
 * - N x N overlap matrix
 */
export function analyzeFamily(
  libraries: MemberLibrary[],
  region: SteamRegion,
  includeExcluded: boolean = false,
  now: Date = new Date()
): FamilyAnalysis {
  const regionCfg = STEAM_REGIONS[region];
  const gameOwners = new Map<
    number,
    { game: MemberLibrary["games"][number]; owners: MemberLibrary[] }
  >();
  let excludedGamesCount = 0;

  for (const lib of libraries) {
    for (const game of lib.games) {
      if (game.familySharingExcluded) {
        excludedGamesCount += 1;
        if (!includeExcluded) continue;
      }
      const existing = gameOwners.get(game.appid);
      if (existing) {
        if (!existing.owners.some((o) => o.member.id === lib.member.id)) {
          existing.owners.push(lib);
        }
      } else {
        gameOwners.set(game.appid, { game, owners: [lib] });
      }
    }
  }

  const catalog: CatalogEntry[] = [];
  let uniqueCatalogValue = 0;

  for (const { game, owners } of gameOwners.values()) {
    uniqueCatalogValue += game.rawPrice;
    catalog.push({
      game,
      ownerIds: owners.map((o) => o.member.id),
      ownerNames: owners.map((o) => o.member.name),
      isExclusive: owners.length === 1,
    });
  }

  catalog.sort((a, b) => {
    if (b.game.rawPrice !== a.game.rawPrice) {
      return b.game.rawPrice - a.game.rawPrice;
    }
    return a.game.name.localeCompare(b.game.name);
  });

  // Build N x N overlap matrix
  const overlapMatrix: Record<string, Record<string, number>> = {};
  for (const libA of libraries) {
    overlapMatrix[libA.member.id] = {};
    const setA = new Set(
      libA.games
        .filter((g) => includeExcluded || !g.familySharingExcluded)
        .map((g) => g.appid)
    );
    for (const libB of libraries) {
      let count = 0;
      for (const g of libB.games) {
        if (!includeExcluded && g.familySharingExcluded) continue;
        if (setA.has(g.appid)) count += 1;
      }
      overlapMatrix[libA.member.id][libB.member.id] = count;
    }
  }

  // Per-member raw totals
  const rawMembers = libraries.map((lib) => {
    const eligibleGames = lib.games.filter(
      (g) => includeExcluded || !g.familySharingExcluded
    );
    let totalRawValue = 0;
    let exclusiveGames = 0;
    let sharedGames = 0;
    let exclusiveValue = 0;

    for (const game of eligibleGames) {
      totalRawValue += game.rawPrice;
      const entry = gameOwners.get(game.appid);
      if (entry && entry.owners.length === 1) {
        exclusiveGames += 1;
        exclusiveValue += game.rawPrice;
      } else {
        sharedGames += 1;
      }
    }

    return {
      lib,
      totalGames: eligibleGames.length,
      exclusiveGames,
      sharedGames,
      totalRawValue: round2(totalRawValue),
      exclusiveValue: round2(exclusiveValue),
    };
  });

  const sumCopiesCount = rawMembers.reduce((acc, m) => acc + m.totalGames, 0);
  const sumCopiesValue = round2(
    rawMembers.reduce((acc, m) => acc + m.totalRawValue, 0)
  );

  const members: MemberContribution[] = rawMembers
    .map((m) => ({
      memberId: m.lib.member.id,
      name: m.lib.member.name,
      personaName: m.lib.personaName,
      avatarUrl: m.lib.avatarUrl,
      steamId64: m.lib.steamId64,
      profileUrl: m.lib.profileUrl,
      totalGames: m.totalGames,
      exclusiveGames: m.exclusiveGames,
      sharedGames: m.sharedGames,
      totalRawValue: m.totalRawValue,
      exclusiveValue: m.exclusiveValue,
      sharePercent:
        sumCopiesValue > 0
          ? round2((m.totalRawValue / sumCopiesValue) * 100)
          : 0,
      cooldown: computeSlotCooldown(m.lib.member.joinDate, now),
    }))
    .sort((a, b) => b.totalRawValue - a.totalRawValue);

  return {
    region,
    currencySymbol: regionCfg.symbol,
    uniqueGamesCount: catalog.length,
    uniqueCatalogValue: round2(uniqueCatalogValue),
    sumCopiesCount,
    sumCopiesValue,
    excludedGamesCount,
    members,
    overlapMatrix,
    catalog,
  };
}

/**
 * Simulates swapping an active family member with a waitlisted friend.
 */
export function simulateSwap(
  activeLibraries: MemberLibrary[],
  removeMemberId: string,
  addLibrary: MemberLibrary,
  region: SteamRegion,
  includeExcluded: boolean = false,
  now: Date = new Date()
): SwapSimulationResult | null {
  const target = activeLibraries.find((l) => l.member.id === removeMemberId);
  if (!target) return null;

  const before = analyzeFamily(activeLibraries, region, includeExcluded, now);
  const nextLibraries = activeLibraries
    .filter((l) => l.member.id !== removeMemberId)
    .concat(addLibrary);
  const after = analyzeFamily(nextLibraries, region, includeExcluded, now);

  const beforeMap = new Map(before.members.map((m) => [m.memberId, m]));
  const afterMap = new Map(after.members.map((m) => [m.memberId, m]));

  const allIds = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const shareDeltas: SwapShareDelta[] = [];

  for (const id of allIds) {
    const b = beforeMap.get(id);
    const a = afterMap.get(id);
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
    removedMemberId: target.member.id,
    removedMemberName: target.member.name,
    addedMemberId: addLibrary.member.id,
    addedMemberName: addLibrary.member.name,
    removedSlotCooldown: computeSlotCooldown(target.member.joinDate, now),
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
