import { NextRequest, NextResponse } from "next/server";
import { STEAM_SESSION_COOKIE, verifySteamSession } from "@/lib/steam-auth";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(STEAM_SESSION_COOKIE)?.value;
  const user = verifySteamSession(token);

  return NextResponse.json(
    { user },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
