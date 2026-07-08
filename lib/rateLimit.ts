import { createHmac } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

function hashRateLimitKey(key: string) {
  const secret =
    process.env.RATE_LIMIT_HASH_SECRET ||
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "koluj-rate-limit";

  return createHmac("sha256", secret).update(key).digest("hex");
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key: hashRateLimitKey(key),
    p_limit: limit,
    p_window_seconds: Math.ceil(windowMs / 1000),
  });

  if (error) {
    console.error("Rate limit error:", error);

    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowMs,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowMs,
    };
  }

  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining || 0),
    resetAt: new Date(row.reset_at).getTime(),
  };
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return Response.json(
    { error: "Příliš mnoho požadavků. Zkus to prosím za chvíli." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    },
  );
}
