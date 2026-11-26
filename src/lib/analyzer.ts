import type {
  CatalogEntry,
  FairnessMemberStatus,
  FairnessSummary,
  FamilyAnalysis,
  MemberContribution,
  MemberLibrary,
  MultiSwapSimulationResult,
  SlotCooldownStatus,
  SteamRegion,
  SwapShareDelta,
  SwapSimulationResult,
  TwoFamilySplitMode,
  TwoFamilySplitResult,
} from "./types";

const REGION_SYMBOLS: Record<SteamRegion, string> = {
  ma: "$",
  us: "$",
  eu: "€",
  gb: "£",
  br: "R$",
  jp: "¥",
};

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
  const currencySymbol = REGION_SYMBOLS[region];
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

  let fairness: FairnessSummary;
  if (members.length === 0) {
    fairness = {
      averageRawValue: 0,
      expectedSharePercent: 0,
      upNextMemberId: null,
      upNextMemberName: null,
      members: [],
    };
  } else {
    const averageRawValue = round2(sumCopiesValue / members.length);
    const expectedSharePercent = round2(100 / members.length);
    const sortedAsc = [...members].sort(
      (a, b) => a.totalRawValue - b.totalRawValue || a.name.localeCompare(b.name)
    );
    const fairnessMembers: FairnessMemberStatus[] = sortedAsc.map((m, idx) => ({
      memberId: m.memberId,
      name: m.name,
      totalRawValue: m.totalRawValue,
      sharePercent: m.sharePercent,
      expectedSharePercent,
      deltaFromAverageValue: round2(m.totalRawValue - averageRawValue),
      deltaFromAveragePct: round2(m.sharePercent - expectedSharePercent),
      isUpNext: idx === 0,
    }));

    fairness = {
      averageRawValue,
      expectedSharePercent,
      upNextMemberId: fairnessMembers[0].memberId,
      upNextMemberName: fairnessMembers[0].name,
      members: fairnessMembers,
    };
  }

  return {
    region,
    currencySymbol,
    uniqueGamesCount: catalog.length,
    uniqueCatalogValue: round2(uniqueCatalogValue),
    sumCopiesCount,
    sumCopiesValue,
    excludedGamesCount,
    members,
    overlapMatrix,
    catalog,
    fairness,
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

/**
 * Simulates an arbitrary multi-member roster change (multiple swaps at once).
 */
export function simulateRosterChange(
  beforeLibraries: MemberLibrary[],
  afterLibraries: MemberLibrary[],
  region: SteamRegion,
  includeExcluded: boolean = false,
  now: Date = new Date()
): MultiSwapSimulationResult {
  const before = analyzeFamily(beforeLibraries, region, includeExcluded, now);
  const after = analyzeFamily(afterLibraries, region, includeExcluded, now);

  const beforeIdSet = new Set(beforeLibraries.map((l) => l.member.id));
  const afterIdSet = new Set(afterLibraries.map((l) => l.member.id));

  const removedMembers = beforeLibraries
    .filter((l) => !afterIdSet.has(l.member.id))
    .map((l) => ({
      memberId: l.member.id,
      name: l.member.name,
      cooldown: computeSlotCooldown(l.member.joinDate, now),
    }));

  const addedMembers = afterLibraries
    .filter((l) => !beforeIdSet.has(l.member.id))
    .map((l) => ({
      memberId: l.member.id,
      name: l.member.name,
    }));

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
    removedMembers,
    addedMembers,
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

/**
 * Splits up to 12 members into two Steam Families (max 6 per family)
 * according to the chosen fairness objective.
 */
export function splitIntoTwoFamilies(
  allLibraries: MemberLibrary[],
  mode: TwoFamilySplitMode,
  includeExcluded: boolean = false
): TwoFamilySplitResult | null {
  const pool = allLibraries.slice(0, 12);
  const n = pool.length;
  if (n < 2) return null;

  // Map every eligible appid to a compact integer index and price.
  const appIdToIdx = new Map<number, number>();
  const idxPrices: number[] = [];

  for (const lib of pool) {
    for (const game of lib.games) {
      if (!includeExcluded && game.familySharingExcluded) continue;
      if (!appIdToIdx.has(game.appid)) {
        appIdToIdx.set(game.appid, idxPrices.length);
        idxPrices.push(game.rawPrice);
      }
    }
  }

  const totalGames = idxPrices.length;
  const wordCount = Math.max(1, Math.ceil(totalGames / 32));
  const memberBitsets: Uint32Array[] = pool.map((lib) => {
    const bits = new Uint32Array(wordCount);
    for (const game of lib.games) {
      if (!includeExcluded && game.familySharingExcluded) continue;
      const idx = appIdToIdx.get(game.appid);
      if (idx !== undefined) {
        bits[idx >>> 5] |= 1 << (idx & 31);
      }
    }
    return bits;
  });

  // Precompute popcount lookup for 16-bit chunks.
  const pop16 = new Uint8Array(65536);
  for (let i = 1; i < 65536; i++) {
    pop16[i] = pop16[i >> 1] + (i & 1);
  }

  const evalSubset = (mask: number): { games: number; value: number } => {
    const union = new Uint32Array(wordCount);
    for (let m = 0; m < n; m++) {
      if ((mask & (1 << m)) === 0) continue;
      const bits = memberBitsets[m];
      for (let w = 0; w < wordCount; w++) {
        union[w] |= bits[w];
      }
    }
    let games = 0;
    let value = 0;
    for (let w = 0; w < wordCount; w++) {
      let word = union[w];
      if (word === 0) continue;
      games += pop16[word & 0xffff] + pop16[(word >>> 16) & 0xffff];
      const base = w * 32;
      while (word !== 0) {
        const lsb = word & -word;
        const bit = 31 - Math.clz32(lsb);
        value += idxPrices[base + bit];
        word ^= lsb;
      }
    }
    return { games, value: round2(value) };
  };

  const fullMask = (1 << n) - 1;
  const targetSizeA =
    mode === "stacked-main" ? Math.min(6, n - 1) : Math.ceil(n / 2);

  let bestMaskA = -1;
  let bestResA = { games: 0, value: 0 };
  let bestResB = { games: 0, value: 0 };
  let bestScore: [number, number, number] | null = null;

  const isBetter = (a: [number, number, number], b: [number, number, number]) => {
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] < b[i];
    }
    return false;
  };

  // Enumerate all subsets of size targetSizeA (fix member 0 in A for balanced modes to halve search).
  for (let mask = 1; mask < fullMask; mask++) {
    if (mode !== "stacked-main" && (mask & 1) === 0) continue;
    let countA = 0;
    for (let m = 0; m < n; m++) {
      if ((mask & (1 << m)) !== 0) countA++;
    }
    if (countA !== targetSizeA) continue;
    const countB = n - countA;
    if (countA > 6 || countB > 6) continue;

    const resA = evalSubset(mask);
    const resB = evalSubset(fullMask ^ mask);

    let score: [number, number, number];
    if (mode === "equal-games") {
      score = [
        Math.abs(resA.games - resB.games),
        Math.abs(resA.value - resB.value),
        -(resA.games + resB.games),
      ];
    } else if (mode === "equal-value") {
      score = [
        Math.abs(resA.value - resB.value),
        Math.abs(resA.games - resB.games),
        -(resA.value + resB.value),
      ];
    } else {
      score = [-resA.value, -resA.games, -resB.value];
    }

    if (!bestScore || isBetter(score, bestScore)) {
      bestScore = score;
      bestMaskA = mask;
      bestResA = resA;
      bestResB = resB;
    }
  }

  if (bestMaskA === -1) return null;

  const membersA = pool.filter((_, idx) => (bestMaskA & (1 << idx)) !== 0);
  const membersB = pool.filter((_, idx) => (bestMaskA & (1 << idx)) === 0);

  return {
    mode,
    familyA: {
      members: membersA,
      uniqueGamesCount: bestResA.games,
      uniqueCatalogValue: bestResA.value,
    },
    familyB: {
      members: membersB,
      uniqueGamesCount: bestResB.games,
      uniqueCatalogValue: bestResB.value,
    },
    gamesGap: Math.abs(bestResA.games - bestResB.games),
    valueGap: round2(Math.abs(bestResA.value - bestResB.value)),
    combinedUniqueGames: totalGames,
  };
}
