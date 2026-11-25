import { NextRequest, NextResponse } from "next/server";
import { buildSteamOpenIdUrl, getPublicOrigin } from "@/lib/steam-auth";

export async function GET(req: NextRequest) {
  const origin = getPublicOrigin(req);
  const redirectUrl = buildSteamOpenIdUrl(origin);
  return NextResponse.redirect(redirectUrl, 302);
}
