import { NextRequest, NextResponse } from "next/server";
import {
  getSteamUserFromRequest,
  loadFamilyRecord,
  resolveMembersWithSteamIds,
} from "@/lib/family-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { generateSlug, getSteamFamDb } from "@/lib/supabase";
import {
  FamilyAnalysis,
  FamilyMemberInput,
  STEAM_REGIONS,
  SteamRegion,
} from "@/lib/types";

interface CreateFamilyBody {
  name?: string;
  region?: SteamRegion;
  members?: FamilyMemberInput[];
  waitlist?: FamilyMemberInput[];
  initialAnalysis?: FamilyAnalysis;
}

const ACTIVE_MEMBER_CONFLICT_MSG =
  "One of these active Steam accounts is already in another Steam Family. Move them to Waitlist or leave the other family first.";

export async function POST(req: NextRequest) {
  const db = getSteamFamDb();
  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured on this server." },
      { status: 503 }
    );
  }

  const user = getSteamUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in with Steam to save your family." },
      { status: 401 }
    );
  }

  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`create-family:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          "Too many families created recently. Please wait before creating another.",
      },
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
    const waitlistMembers = (body.waitlist ?? []).slice(0, 6);

    if (activeMembers.length === 0) {
      return NextResponse.json(
        { error: "At least one active family member is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.STEAM_API_KEY;
    const [resolvedActive, resolvedWaitlist] = await Promise.all([
      resolveMembersWithSteamIds(activeMembers, apiKey),
      resolveMembersWithSteamIds(waitlistMembers, apiKey),
    ]);

    const slug = generateSlug(name);

    const { data: family, error: famErr } = await db
      .from("families")
      .insert({
        slug,
        name,
        region,
        owner_steam_id64: user.steamId64,
        edit_key_hash: null,
      })
      .select("id")
      .single();

    if (famErr || !family) {
      throw new Error(famErr?.message ?? "Failed to create family record");
    }

    const memberRows = [
      ...resolvedActive.map((m, idx) => ({
        family_id: family.id,
        display_name: m.name.trim() || `Member ${idx + 1}`,
        steam_input: m.steamUrlOrId.trim() || m.name.trim(),
        steam_id64: m.steamId64,
        join_date: m.joinDate || null,
        is_waitlist: false,
        position: idx,
      })),
      ...resolvedWaitlist.map((w, idx) => ({
        family_id: family.id,
        display_name: w.name.trim() || `Waitlist ${idx + 1}`,
        steam_input: w.steamUrlOrId.trim() || w.name.trim(),
        steam_id64: w.steamId64,
        join_date: null,
        is_waitlist: true,
        position: idx,
      })),
    ];

    const { error: memErr } = await db.from("family_members").insert(memberRows);
    if (memErr) {
      await db.from("families").delete().eq("id", family.id);
      if (
        memErr.code === "23505" ||
        memErr.message?.includes("uq_active_member_steam_id64")
      ) {
        return NextResponse.json(
          { error: ACTIVE_MEMBER_CONFLICT_MSG },
          { status: 409 }
        );
      }
      throw new Error(memErr.message);
    }

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

    const saved = await loadFamilyRecord(db, { id: family.id }, user.steamId64);
    if (!saved) {
      throw new Error("Created family could not be loaded.");
    }

    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save family";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
