import { NextRequest, NextResponse } from "next/server";
import {
  canViewFamily,
  getSteamUserFromRequest,
  loadFamilyRecord,
  resolveMembersWithSteamIds,
} from "@/lib/family-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getSteamFamDb } from "@/lib/supabase";
import { FamilyMemberInput, STEAM_REGIONS, SteamRegion } from "@/lib/types";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const ACTIVE_MEMBER_CONFLICT_MSG =
  "One of these active Steam accounts is already in another Steam Family. Move them to Waitlist or leave the other family first.";

export async function GET(req: NextRequest, context: RouteContext) {
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
      { error: "Sign in with Steam to view this family." },
      { status: 401 }
    );
  }

  const { slug } = await context.params;
  const family = await loadFamilyRecord(db, { slug }, user.steamId64);

  if (!family) {
    return NextResponse.json(
      { error: "Family group not found." },
      { status: 404 }
    );
  }

  if (!canViewFamily(family, user.steamId64)) {
    return NextResponse.json(
      {
        error:
          "Private family: only members and waitlisted friends can view this group.",
      },
      { status: 403 }
    );
  }

  return NextResponse.json(family);
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

  const user = getSteamUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in with Steam to edit this family." },
      { status: 401 }
    );
  }

  const { slug } = await context.params;
  const ip = getClientIp(req.headers);
  const rl = checkRateLimit(`edit-family:${ip}:${slug}`, 15, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Too many edit attempts. Try again in ${rl.resetInSeconds}s.`,
      },
      { status: 429, headers: { "Retry-After": String(rl.resetInSeconds) } }
    );
  }

  const { data: family, error: famErr } = await db
    .from("families")
    .select("id, owner_steam_id64")
    .eq("slug", slug)
    .maybeSingle();

  if (famErr || !family) {
    return NextResponse.json(
      { error: "Family group not found." },
      { status: 404 }
    );
  }

  if (family.owner_steam_id64 !== user.steamId64) {
    return NextResponse.json(
      { error: "Only the family creator can edit this roster." },
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
      const waitlistMembers = (body.waitlist ?? []).slice(0, 6);
      const apiKey = process.env.STEAM_API_KEY;

      const [resolvedActive, resolvedWaitlist, { data: previousRows }] =
        await Promise.all([
          resolveMembersWithSteamIds(activeMembers, apiKey),
          resolveMembersWithSteamIds(waitlistMembers, apiKey),
          db
            .from("family_members")
            .select(
              "family_id, display_name, steam_input, steam_id64, join_date, is_waitlist, position"
            )
            .eq("family_id", family.id),
        ]);

      await db.from("family_members").delete().eq("family_id", family.id);

      const rows = [
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

      if (rows.length > 0) {
        const { error: insErr } = await db.from("family_members").insert(rows);
        if (insErr) {
          if (previousRows && previousRows.length > 0) {
            await db.from("family_members").insert(previousRows);
          }
          if (
            insErr.code === "23505" ||
            insErr.message?.includes("uq_active_member_steam_id64")
          ) {
            return NextResponse.json(
              { error: ACTIVE_MEMBER_CONFLICT_MSG },
              { status: 409 }
            );
          }
          throw new Error(insErr.message);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update family";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
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
      { error: "Sign in with Steam to delete this family." },
      { status: 401 }
    );
  }

  const { slug } = await context.params;
  const { data: family, error: famErr } = await db
    .from("families")
    .select("id, owner_steam_id64")
    .eq("slug", slug)
    .maybeSingle();

  if (famErr || !family) {
    return NextResponse.json(
      { error: "Family group not found." },
      { status: 404 }
    );
  }

  if (family.owner_steam_id64 !== user.steamId64) {
    return NextResponse.json(
      { error: "Only the family creator can delete this family." },
      { status: 403 }
    );
  }

  const { error: delErr } = await db
    .from("families")
    .delete()
    .eq("id", family.id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
