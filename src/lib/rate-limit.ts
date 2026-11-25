interface RateWindow {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateWindow>();

/**
 * Extracts a best-effort client IP from Cloudflare / reverse-proxy headers.
 */
export function getClientIp(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  return "local";
}

/**
 * Simple fixed-window in-memory rate limiter for protecting Steam API quota and write routes.
 */
export function checkRateLimit(
  key: string,
  limit: number = 20,
  windowMs: number = 10 * 60 * 1000
): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const now = Date.now();

  if (buckets.size > 500) {
    for (const [bucketKey, window] of buckets) {
      if (window.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
  }

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    resetInSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}
