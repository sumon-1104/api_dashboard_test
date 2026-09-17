import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/** For Route Handlers: returns the authenticated user, or a 401 response to return as-is. */
export async function requireApiUser(): Promise<{ user: User } | { unauthorized: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user };
}

export function requireCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("x-cron-secret");
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
