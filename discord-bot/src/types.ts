export type SteamRegion = "ma" | "us" | "eu" | "gb" | "br" | "jp";

export const STEAM_REGIONS: Record<
  SteamRegion,
  { code: SteamRegion; label: string; currency: string; symbol: string }
> = {
  ma: { code: "ma", label: "MENA-USD (ma)", currency: "USD", symbol: "$" },
  us: { code: "us", label: "United States (us)", currency: "USD", symbol: "$" },
  eu: { code: "eu", label: "Europe (eu)", currency: "EUR", symbol: "€" },
  gb: { code: "gb", label: "United Kingdom (gb)", currency: "GBP", symbol: "£" },
  br: { code: "br", label: "Brazil (br)", currency: "BRL", symbol: "R$" },
  jp: { code: "jp", label: "Japan (jp)", currency: "JPY", symbol: "¥" },
};

export interface GameInfo {
  appid: number;
  name: string;
  rawPrice: number;
  isFree: boolean;
  familySharingExcluded: boolean;
  headerImage: string;
}

export interface FamilyMemberInput {
  id: string;
  name: string;
  steamUrlOrId: string;
  joinDate?: string;
  isWaitlist?: boolean;
}

export interface MemberLibrary {
  member: FamilyMemberInput;
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  games: GameInfo[];
  excludedCount: number;
}

export interface SlotCooldownStatus {
  joinDate: string | null;
  slotUnlockDate: string | null;
  isSlotUnlocked: boolean;
  daysUntilUnlock: number | null;
}

export interface MemberContribution {
  memberId: string;
  name: string;
  personaName: string;
  avatarUrl: string;
  steamId64: string;
  profileUrl: string;
  totalGames: number;
  exclusiveGames: number;
  sharedGames: number;
  totalRawValue: number;
  exclusiveValue: number;
  sharePercent: number;
  cooldown: SlotCooldownStatus;
}

export interface FamilyAnalysis {
  region: SteamRegion;
  currencySymbol: string;
  uniqueGamesCount: number;
  uniqueCatalogValue: number;
  sumCopiesCount: number;
  sumCopiesValue: number;
  excludedGamesCount: number;
  members: MemberContribution[];
}

export interface AnalyzeResponse {
  mode: "demo" | "live";
  analysis: FamilyAnalysis;
  activeLibraries: MemberLibrary[];
  waitlistLibraries: MemberLibrary[];
}

export interface SnapshotMemberEntry {
  name: string;
  steamId64: string;
  totalGames: number;
  exclusiveGames: number;
  totalRawValue: number;
  sharePercent: number;
}

export interface MonthlySnapshotRecord {
  id: string;
  snapshotMonth: string;
  region: SteamRegion;
  uniqueGamesCount: number;
  uniqueCatalogValue: number;
  sumCopiesCount: number;
  sumCopiesValue: number;
  memberBreakdown: SnapshotMemberEntry[];
  createdAt: string;
}

export interface SavedFamilyData {
  id: string;
  slug: string;
  name: string;
  region: SteamRegion;
  members: FamilyMemberInput[];
  waitlist: FamilyMemberInput[];
  snapshots: MonthlySnapshotRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface SwapShareDelta {
  memberId: string;
  name: string;
  beforePct: number;
  afterPct: number;
  deltaPct: number;
}

export interface SwapSimulationResult {
  removedMemberName: string;
  addedMemberName: string;
  removedSlotCooldown: SlotCooldownStatus;
  beforeUniqueGames: number;
  afterUniqueGames: number;
  uniqueGamesDelta: number;
  beforeUniqueValue: number;
  afterUniqueValue: number;
  uniqueValueDelta: number;
  shareDeltas: SwapShareDelta[];
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Computes Steam Families' 1-year-from-join-date slot cooldown.
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
