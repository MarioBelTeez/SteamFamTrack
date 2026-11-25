export type SteamRegion = "ma" | "us" | "eu" | "gb" | "br" | "jp";

export interface RegionConfig {
  code: SteamRegion;
  label: string;
  currency: string;
  symbol: string;
}

export const STEAM_REGIONS: Record<SteamRegion, RegionConfig> = {
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
  /** Raw non-discounted price in the selected region */
  rawPrice: number;
  isFree: boolean;
  familySharingExcluded: boolean;
  headerImage: string;
}

export interface FamilyMemberInput {
  id: string;
  name: string;
  steamUrlOrId: string;
  /** ISO date string (YYYY-MM-DD) when the member joined the Steam Family */
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

export interface CatalogEntry {
  game: GameInfo;
  ownerIds: string[];
  ownerNames: string[];
  isExclusive: boolean;
}

export interface FairnessMemberStatus {
  memberId: string;
  name: string;
  totalRawValue: number;
  sharePercent: number;
  expectedSharePercent: number;
  deltaFromAverageValue: number;
  deltaFromAveragePct: number;
  isUpNext: boolean;
}

export interface FairnessSummary {
  averageRawValue: number;
  expectedSharePercent: number;
  upNextMemberId: string | null;
  upNextMemberName: string | null;
  members: FairnessMemberStatus[];
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
  overlapMatrix: Record<string, Record<string, number>>;
  catalog: CatalogEntry[];
  fairness: FairnessSummary;
}

export interface SwapShareDelta {
  memberId: string;
  name: string;
  beforePct: number;
  afterPct: number;
  deltaPct: number;
}

export interface SwapSimulationResult {
  removedMemberId: string;
  removedMemberName: string;
  addedMemberId: string;
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
  snapshotMonth: string; // YYYY-MM
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
