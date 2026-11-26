import { NextRequest, NextResponse } from "next/server";
import { getSteamUserFromRequest } from "@/lib/family-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getMonthKey, isValidSnapshotPeriod } from "@/lib/snapshot-periods";
import { getSteamFamDb } from "@/lib/supabase";
import { FamilyAnalysis, STEAM_REGIONS } from "@/lib/types";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

interface SnapshotBody {
  snapshotMonth?: string; // Optional YYYY-MM, defaults to current UTC month
  analysis?: FamilyAnalysis;
}

export async function POST(req: NextRequest, context: RouteContext) {
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
      { error: "Sign in with Steam to record snapshots." },
      { status: 401 }
    );
  }

  const { slug } = await context.params;
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`snapshot:${ip}:${slug}`, 20, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Too many snapshot requests. Try again in ${rl.resetInSeconds}s.`,
      },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  const { data: family } = await db
    .from("families")
    .select("id, owner_steam_id64")
    .eq("slug", slug)
    .maybeSingle();

  if (!family) {
    return NextResponse.json(
      { error: "Family group not found." },
      { status: 404 }
    );
  }

  if (family.owner_steam_id64 !== user.steamId64) {
    return NextResponse.json(
      { error: "Only the family creator can record snapshots." },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as SnapshotBody;
    const analysis = body.analysis;
    if (!analysis || !Array.isArray(analysis.members)) {
      return NextResponse.json(
        { error: "Valid analysis payload is required." },
        { status: 400 }
      );
    }

    if (body.snapshotMonth !== undefined && body.snapshotMonth !== "") {
      if (
        typeof body.snapshotMonth !== "string" ||
        !isValidSnapshotPeriod(body.snapshotMonth)
      ) {
        return NextResponse.json(
          {
            error:
              "snapshotMonth must be in YYYY-MM (monthly) or YYYY-Www (weekly) format.",
          },
          { status: 400 }
        );
      }
    }

    const monthKey =
      body.snapshotMonth && body.snapshotMonth.length > 0
        ? body.snapshotMonth.trim()
        : getMonthKey();

    const region =
      analysis.region in STEAM_REGIONS ? analysis.region : "ma";

    const { data, error } = await db
      .from("monthly_snapshots")
      .upsert(
        {
          family_id: family.id,
          snapshot_month: monthKey,
          region,
          unique_games_count: analysis.uniqueGamesCount,
          unique_catalog_value: analysis.uniqueCatalogValue,
          sum_copies_count: analysis.sumCopiesCount,
          sum_copies_value: analysis.sumCopiesValue,
          member_breakdown: analysis.members.map((m) => ({
            name: m.name,
            steamId64: m.steamId64,
            totalGames: m.totalGames,
            exclusiveGames: m.exclusiveGames,
            totalRawValue: m.totalRawValue,
            sharePercent: m.sharePercent,
          })),
        },
        { onConflict: "family_id,snapshot_month" }
      )
      .select(
        "id, snapshot_month, region, unique_games_count, unique_catalog_value, sum_copies_count, sum_copies_value, member_breakdown, created_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to save snapshot");
    }

    return NextResponse.json({
      id: data.id,
      snapshotMonth: data.snapshot_month,
      region: data.region,
      uniqueGamesCount: Number(data.unique_games_count),
      uniqueCatalogValue: Number(data.unique_catalog_value),
      sumCopiesCount: Number(data.sum_copies_count),
      sumCopiesValue: Number(data.sum_copies_value),
      memberBreakdown: data.member_breakdown,
      createdAt: data.created_at,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save snapshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
