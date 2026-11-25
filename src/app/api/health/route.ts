import { NextResponse } from "next/server";
import { getSteamFamDb, hasSupabaseConfig } from "@/lib/supabase";

export async function GET() {
  const hasApiKey = Boolean(process.env.STEAM_API_KEY);
  const hasDatabase = hasSupabaseConfig();
  let databaseReachable = false;

  if (hasDatabase) {
    const db = getSteamFamDb();
    if (db) {
      try {
        const { error } = await db
          .from("families")
          .select("id", { count: "exact", head: true });
        databaseReachable = !error;
      } catch {
        databaseReachable = false;
      }
    }
  }

  const ok = !hasDatabase || databaseReachable;
  const status = ok ? 200 : 503;

  return NextResponse.json(
    {
      ok,
      hasApiKey,
      hasDatabase,
      databaseReachable,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}
