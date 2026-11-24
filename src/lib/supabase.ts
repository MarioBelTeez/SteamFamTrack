import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedClient: SupabaseClient<any, "steamfam"> | null = null;

export function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Returns a server-side Supabase client strictly scoped to the isolated `steamfam` schema.
 * Never expose SUPABASE_SERVICE_ROLE_KEY to client components.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSteamFamDb(): SupabaseClient<any, "steamfam"> | null {
  if (!hasSupabaseConfig()) return null;
  if (cachedClient) return cachedClient;

  cachedClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "steamfam" },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
  return cachedClient;
}

export function hashEditKey(plainKey: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(plainKey, salt, 32).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyEditKey(plainKey: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(plainKey, salt, 32);
  const expected = Buffer.from(keyHex, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = crypto.randomBytes(2).toString("hex");
  return `${base || "family"}-${suffix}`;
}

export function generateEditPasscode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}
