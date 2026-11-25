import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { parseSteamIdentifier, resolveSteamId64 } from "./steam";
import {
  STEAM_SESSION_COOKIE,
  type SteamSessionUser,
  verifySteamSession,
} from "./steam-auth";
import type { getSteamFamDb } from "./supabase";
import {
  type FamilyMemberInput,
  type MonthlySnapshotRecord,
  STEAM_REGIONS,
  type SavedFamilyData,
  type SteamRegion,
} from "./types";

export type SteamFamDb = NonNullable<ReturnType<typeof getSteamFamDb>>;

export interface ResolvedMemberInput extends FamilyMemberInput {
  steamId64: string | null;
}

export async function getSteamUserFromCookies(): Promise<SteamSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STEAM_SESSION_COOKIE)?.value;
  return verifySteamSession(token);
}

export function getSteamUserFromRequest(
  req: NextRequest
): SteamSessionUser | null {
  const token = req.cookies.get(STEAM_SESSION_COOKIE)?.value;
  return verifySteamSession(token);
}

export async function resolveMembersWithSteamIds(
  members: FamilyMemberInput[],
  apiKey?: string
): Promise<ResolvedMemberInput[]> {
  return Promise.all(
    members.map(async (member) => {
      const input = (member.steamUrlOrId ?? "").trim();
      if (!input) {
        return { ...member, steamId64: null };
      }

      const parsed = parseSteamIdentifier(input);
      if (parsed.type === "steamid64") {
        return { ...member, steamId64: parsed.value };
      }

      if (apiKey) {
        try {
          const steamId64 = await resolveSteamId64(input, apiKey);
          return { ...member, steamId64 };
        } catch {
          return { ...member, steamId64: null };
        }
      }

      return { ...member, steamId64: null };
    })
  );
}

export async function loadFamilyRecord(
  db: SteamFamDb,
  filter: { id?: string; slug?: string },
  viewerSteamId64?: string | null
): Promise<SavedFamilyData | null> {
  if (!filter.id && !filter.slug) return null;

  let query = db
    .from("families")
    .select("id, slug, name, region, owner_steam_id64, created_at, updated_at");

  if (filter.id) {
    query = query.eq("id", filter.id);
  } else if (filter.slug) {
    query = query.eq("slug", filter.slug);
  }

  const { data: family, error: famErr } = await query.maybeSingle();
  if (famErr || !family) return null;

  const [{ data: memberRows }, { data: snapshotRows }] = await Promise.all([
    db
      .from("family_members")
      .select(
        "id, display_name, steam_input, steam_id64, join_date, is_waitlist, position"
      )
      .eq("family_id", family.id)
      .order("position", { ascending: true }),
    db
      .from("monthly_snapshots")
      .select(
        "id, snapshot_month, region, unique_games_count, unique_catalog_value, sum_copies_count, sum_copies_value, member_breakdown, created_at"
      )
      .eq("family_id", family.id)
      .order("snapshot_month", { ascending: false }),
  ]);

  const rows = memberRows ?? [];
  const allMembers: FamilyMemberInput[] = rows.map((r) => ({
    id: r.id,
    name: r.display_name,
    steamUrlOrId: r.steam_input,
    joinDate: r.join_date ?? undefined,
    isWaitlist: Boolean(r.is_waitlist),
  }));

  let userRole: SavedFamilyData["userRole"];
  if (viewerSteamId64) {
    if (family.owner_steam_id64 === viewerSteamId64) {
      userRole = "owner";
    } else if (
      rows.some((r) => !r.is_waitlist && r.steam_id64 === viewerSteamId64)
    ) {
      userRole = "active";
    } else if (
      rows.some((r) => Boolean(r.is_waitlist) && r.steam_id64 === viewerSteamId64)
    ) {
      userRole = "waitlist";
    }
  }

  const snapshots: MonthlySnapshotRecord[] = (snapshotRows ?? []).map((s) => ({
    id: s.id,
    snapshotMonth: s.snapshot_month,
    region: (s.region in STEAM_REGIONS ? s.region : "ma") as SteamRegion,
    uniqueGamesCount: Number(s.unique_games_count),
    uniqueCatalogValue: Number(s.unique_catalog_value),
    sumCopiesCount: Number(s.sum_copies_count),
    sumCopiesValue: Number(s.sum_copies_value),
    memberBreakdown: Array.isArray(s.member_breakdown)
      ? s.member_breakdown
      : [],
    createdAt: s.created_at,
  }));

  return {
    id: family.id,
    slug: family.slug,
    name: family.name,
    region: (family.region in STEAM_REGIONS ? family.region : "ma") as SteamRegion,
    ownerSteamId64: family.owner_steam_id64 ?? null,
    userRole,
    members: allMembers.filter((m) => !m.isWaitlist),
    waitlist: allMembers.filter((m) => m.isWaitlist),
    snapshots,
    createdAt: family.created_at,
    updatedAt: family.updated_at,
  };
}

export function canViewFamily(
  family: SavedFamilyData,
  viewerSteamId64: string | null
): boolean {
  return Boolean(viewerSteamId64 && family.userRole);
}
