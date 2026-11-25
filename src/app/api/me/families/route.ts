import { NextRequest, NextResponse } from "next/server";
import { getSteamUserFromRequest, loadFamilyRecord } from "@/lib/family-access";
import { getSteamFamDb } from "@/lib/supabase";
import type { SavedFamilyData } from "@/lib/types";

export async function GET(req: NextRequest) {
  const user = getSteamUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { user: null, activeFamily: null, waitlistedIn: [] },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const db = getSteamFamDb();
  if (!db) {
    return NextResponse.json(
      { error: "Database is not configured on this server." },
      { status: 503 }
    );
  }

  const [{ data: ownedRows, error: ownedErr }, { data: memberRows, error: memErr }] =
    await Promise.all([
      db
        .from("families")
        .select("id")
        .eq("owner_steam_id64", user.steamId64),
      db
        .from("family_members")
        .select("family_id, is_waitlist")
        .eq("steam_id64", user.steamId64),
    ]);

  if (ownedErr || memErr) {
    return NextResponse.json(
      { error: ownedErr?.message ?? memErr?.message ?? "Failed to load families." },
      { status: 500 }
    );
  }

  const activeFamilyId: string | undefined =
    ownedRows?.[0]?.id ??
    memberRows?.find((m) => !m.is_waitlist)?.family_id;

  const activeFamily = activeFamilyId
    ? await loadFamilyRecord(db, { id: activeFamilyId }, user.steamId64)
    : null;

  const waitlistFamilyIds = Array.from(
    new Set(
      (memberRows ?? [])
        .filter(
          (m) => Boolean(m.is_waitlist) && m.family_id !== activeFamily?.id
        )
        .map((m) => m.family_id as string)
    )
  );

  const waitlistedResults = await Promise.all(
    waitlistFamilyIds.map((id) => loadFamilyRecord(db, { id }, user.steamId64))
  );
  const waitlistedIn = waitlistedResults.filter(
    (f): f is SavedFamilyData => f !== null
  );

  return NextResponse.json(
    { user, activeFamily, waitlistedIn },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
