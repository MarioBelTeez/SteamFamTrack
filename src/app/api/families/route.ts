import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  generateEditPasscode,
  generateSlug,
  getSteamFamDb,
  hashEditKey,
} from "@/lib/supabase";
import {
  FamilyAnalysis,
  FamilyMemberInput,
  STEAM_REGIONS,
  SteamRegion,
} from "@/lib/types";

interface CreateFamilyBody {
  name?: string;
  region?: SteamRegion;
  editKey?: string;
  members?: FamilyMemberInput[];
  waitlist?: FamilyMemberInput[];
  initialAnalysis?: FamilyAnalysis;
}

export async function POST(req: NextRequest) {
  const db = getSteamFamDb();
  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured on this server." },
      { status: 503 }
    );
  }

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const rl = checkRateLimit(`create-family:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many families created recently. Please wait before creating another." },
      { status: 429 }
    );
  }

  try {
    const body = (await req.json()) as CreateFamilyBody;
    const name = (body.name ?? "").trim();
    if (!name || name.length > 60) {
      return NextResponse.json(
        { error: "Family name must be between 1 and 60 characters." },
        { status: 400 }
      );
    }

    const region: SteamRegion =
      body.region && body.region in STEAM_REGIONS ? body.region : "ma";
    const activeMembers = (body.members ?? []).slice(0, 6);
    const waitlistMembers = (body.waitlist ?? []).slice(0, 10);

    if (activeMembers.length === 0) {
      return NextResponse.json(
        { error: "At least one active family member is required." },
        { status: 400 }
      );
    }

    const plainEditKey =
      body.editKey && body.editKey.trim().length >= 4
        ? body.editKey.trim()
        : generateEditPasscode();
    const editKeyHash = hashEditKey(plainEditKey);
    const slug = generateSlug(name);

    const { data: family, error: famErr } = await db
      .from("families")
      .insert({
        slug,
        name,
        region,
        edit_key_hash: editKeyHash,
      })
      .select("id, slug, name, region, created_at")
      .single();

    if (famErr || !family) {
      throw new Error(famErr?.message ?? "Failed to create family record");
    }

    const memberRows = [
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

    const { error: memErr } = await db.from("family_members").insert(memberRows);
    if (memErr) {
      throw new Error(memErr.message);
    }

    // Optionally record an initial snapshot for the current month
    if (body.initialAnalysis) {
      const monthKey = new Date().toISOString().slice(0, 7);
      await db.from("monthly_snapshots").upsert(
        {
          family_id: family.id,
          snapshot_month: monthKey,
          region,
          unique_games_count: body.initialAnalysis.uniqueGamesCount,
          unique_catalog_value: body.initialAnalysis.uniqueCatalogValue,
          sum_copies_count: body.initialAnalysis.sumCopiesCount,
          sum_copies_value: body.initialAnalysis.sumCopiesValue,
          member_breakdown: body.initialAnalysis.members.map((m) => ({
            name: m.name,
            steamId64: m.steamId64,
            totalGames: m.totalGames,
            exclusiveGames: m.exclusiveGames,
            totalRawValue: m.totalRawValue,
            sharePercent: m.sharePercent,
          })),
        },
        { onConflict: "family_id,snapshot_month" }
      );
    }

    return NextResponse.json(
      {
        slug: family.slug,
        name: family.name,
        region: family.region,
        editKey: plainEditKey,
      },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save family";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
