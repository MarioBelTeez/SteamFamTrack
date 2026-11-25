import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { analyzeFamily } from "@/lib/analyzer";
import { fetchMemberLibrariesLive } from "@/lib/steam";
import { getSteamFamDb, hasSupabaseConfig } from "@/lib/supabase";
import { FamilyMemberInput, STEAM_REGIONS, SteamRegion } from "@/lib/types";

const MAX_FAMILIES_PER_RUN = 15;

function isAuthorized(req: NextRequest, expectedSecret: string): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return false;

  const actualBuf = Buffer.from(token, "utf8");
  const expectedBuf = Buffer.from(expectedSecret, "utf8");
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export async function POST(req: NextRequest) {
  const expectedSecret =
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";

  if (!expectedSecret) {
    if (!hasSupabaseConfig()) {
      return NextResponse.json(
        { error: "Database is not configured on this server." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  if (!isAuthorized(req, expectedSecret)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const db = getSteamFamDb();
  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured on this server." },
      { status: 503 }
    );
  }

  const apiKey = process.env.STEAM_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "STEAM_API_KEY is not configured on this server." },
      { status: 503 }
    );
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  try {
    const [
      { data: families, error: famErr },
      { data: existingSnapshots, error: snapErr },
    ] = await Promise.all([
      db
        .from("families")
        .select("id, slug, name, region")
        .order("created_at", { ascending: true }),
      db
        .from("monthly_snapshots")
        .select("family_id")
        .eq("snapshot_month", currentMonth),
    ]);

    if (famErr) {
      throw new Error(`Failed to query families: ${famErr.message}`);
    }
    if (snapErr) {
      throw new Error(`Failed to query monthly snapshots: ${snapErr.message}`);
    }

    const allFamilies = families ?? [];
    const existingFamilyIds = new Set(
      (existingSnapshots ?? []).map((s) => s.family_id as string)
    );

    const missingFamilies = allFamilies.filter(
      (f) => !existingFamilyIds.has(f.id)
    );
    const batch = missingFamilies.slice(0, MAX_FAMILIES_PER_RUN);

    let created = 0;
    let skipped = allFamilies.length - missingFamilies.length;
    const errors: Array<{ familyId: string; error: string }> = [];

    for (const family of batch) {
      try {
        const { data: memberRows, error: memberErr } = await db
          .from("family_members")
          .select("id, display_name, steam_input, join_date, is_waitlist")
          .eq("family_id", family.id)
          .eq("is_waitlist", false)
          .order("position", { ascending: true });

        if (memberErr) {
          errors.push({
            familyId: family.id,
            error: `Failed to load family members: ${memberErr.message}`,
          });
          continue;
        }

        const activeMembers: FamilyMemberInput[] = (memberRows ?? [])
          .filter(
            (m) =>
              typeof m.steam_input === "string" &&
              m.steam_input.trim().length > 0
          )
          .map((m) => ({
            id: m.id,
            name: m.display_name,
            steamUrlOrId: m.steam_input,
            joinDate: m.join_date ?? undefined,
            isWaitlist: false,
          }));

        if (activeMembers.length === 0) {
          skipped += 1;
          continue;
        }

        const region: SteamRegion =
          family.region && family.region in STEAM_REGIONS
            ? (family.region as SteamRegion)
            : "ma";

        const { libraries, warnings } = await fetchMemberLibrariesLive(
          activeMembers,
          region,
          apiKey
        );

        if (libraries.length === 0) {
          const failureSummary = warnings
            .map((w) => `${w.memberName}: ${w.reason}`)
            .join("; ");
          errors.push({
            familyId: family.id,
            error:
              failureSummary || "Could not load any active Steam profiles.",
          });
          continue;
        }

        const analysis = analyzeFamily(libraries, region);

        const { error: upsertErr } = await db
          .from("monthly_snapshots")
          .upsert(
            {
              family_id: family.id,
              snapshot_month: currentMonth,
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
            { onConflict: "family_id,snapshot_month", ignoreDuplicates: true }
          );

        if (upsertErr) {
          errors.push({
            familyId: family.id,
            error: `Failed to save snapshot: ${upsertErr.message}`,
          });
          continue;
        }

        created += 1;
      } catch (err) {
        errors.push({
          familyId: family.id,
          error:
            err instanceof Error ? err.message : "Failed to snapshot family.",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      month: currentMonth,
      created,
      skipped,
      errors,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to run snapshot cron.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
