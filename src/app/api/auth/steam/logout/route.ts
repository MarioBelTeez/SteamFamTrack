import { NextRequest, NextResponse } from "next/server";
import { STEAM_SESSION_COOKIE, getPublicOrigin } from "@/lib/steam-auth";

export async function POST(req: NextRequest) {
  const origin = getPublicOrigin(req);
  const response = NextResponse.json({ ok: true }, { status: 200 });

  response.cookies.set(STEAM_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: 0,
  });

  return response;
}
