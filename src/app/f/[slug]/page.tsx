import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FamilyDashboard } from "@/components/FamilyDashboard";
import { getSteamFamDb } from "@/lib/supabase";
import {
  FamilyMemberInput,
  MonthlySnapshotRecord,
  STEAM_REGIONS,
  SavedFamilyData,
  SteamRegion,
} from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function loadFamily(slug: string): Promise<SavedFamilyData | null> {
  const db = getSteamFamDb();
  if (!db) return null;

  const { data: family } = await db
    .from("families")
    .select("id, slug, name, region, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!family) return null;

  const [{ data: memberRows }, { data: snapshotRows }] = await Promise.all([
    db
      .from("family_members")
      .select("id, display_name, steam_input, join_date, is_waitlist, position")
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

  const allMembers: FamilyMemberInput[] = (memberRows ?? []).map((r) => ({
    id: r.id,
    name: r.display_name,
    steamUrlOrId: r.steam_input,
    joinDate: r.join_date ?? undefined,
    isWaitlist: Boolean(r.is_waitlist),
  }));

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
    members: allMembers.filter((m) => !m.isWaitlist),
    waitlist: allMembers.filter((m) => m.isWaitlist),
    snapshots,
    createdAt: family.created_at,
    updatedAt: family.updated_at,
  };
}

async function SavedFamilyContent({ params }: PageProps) {
  const { slug } = await params;
  const family = await loadFamily(slug);
  if (!family) {
    notFound();
  }
  return <FamilyDashboard initialFamily={family} />;
}

export default function SavedFamilyPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0b111a] text-sm text-slate-400">
          Loading saved Steam Family...
        </div>
      }
    >
      <SavedFamilyContent params={params} />
    </Suspense>
  );
}
