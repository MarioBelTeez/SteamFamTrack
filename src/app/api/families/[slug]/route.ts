import { NextRequest, NextResponse } from "next/server";
import { getSteamFamDb, verifyEditKey } from "@/lib/supabase";
import {
  FamilyMemberInput,
  MonthlySnapshotRecord,
  STEAM_REGIONS,
  SavedFamilyData,
  SteamRegion,
} from "@/lib/types";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const db = getSteamFamDb();
  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured on this server." },
      { status: 503 }
    );
  }

  const { slug } = await context.params;
  const { data: family, error: famErr } = await db
    .from("families")
    .select("id, slug, name, region, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (famErr) {
    return NextResponse.json({ error: famErr.message }, { status: 500 });
  }
  if (!family) {
    return NextResponse.json({ error: "Family group not found." }, { status: 404 });
  }

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
    memberBreakdown: Array.isArray(s.member_breakdown) ? s.member_breakdown : [],
    createdAt: s.created_at,
  }));

  const payload: SavedFamilyData = {
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

  return NextResponse.json(payload);
}

interface UpdateFamilyBody {
  name?: string;
  region?: SteamRegion;
  members?: FamilyMemberInput[];
  waitlist?: FamilyMemberInput[];
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const db = getSteamFamDb();
  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured on this server." },
      { status: 503 }
    );
  }

  const { slug } = await context.params;
  const editKey = req.headers.get("x-edit-key")?.trim() ?? "";
  if (!editKey) {
    return NextResponse.json(
      { error: "Edit passcode is required (x-edit-key)." },
      { status: 401 }
    );
  }

  const { data: family, error: famErr } = await db
    .from("families")
    .select("id, edit_key_hash")
    .eq("slug", slug)
    .maybeSingle();

  if (famErr || !family) {
    return NextResponse.json({ error: "Family group not found." }, { status: 404 });
  }

  if (!verifyEditKey(editKey, family.edit_key_hash)) {
    return NextResponse.json(
      { error: "Invalid edit passcode." },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as UpdateFamilyBody;
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name && body.name.trim()) patch.name = body.name.trim().slice(0, 60);
    if (body.region && body.region in STEAM_REGIONS) patch.region = body.region;

    await db.from("families").update(patch).eq("id", family.id);

    if (body.members) {
      const activeMembers = body.members.slice(0, 6);
      const waitlistMembers = (body.waitlist ?? []).slice(0, 10);

      await db.from("family_members").delete().eq("family_id", family.id);

      const rows = [
        ...activeMembers.map((m, idx) => ({
          family_id: family.id,
          display_name: m.name.trim() || `Member ${idx + 1}`,
          steam_input: m.steamUrlOrId.trim() || m.name.trim(),
          join_date: m.joinDate || null,
          is_waitlist: false,
          position: idx,
        })),
        ...waitlistMembers.map((w, idx) => ({
          family_id: family.id,
          display_name: w.name.trim() || `Waitlist ${idx + 1}`,
          steam_input: w.steamUrlOrId.trim() || w.name.trim(),
          join_date: null,
          is_waitlist: true,
          position: idx,
        })),
      ];

      if (rows.length > 0) {
        const { error: insErr } = await db.from("family_members").insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update family";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
