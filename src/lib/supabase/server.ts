import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// Server-side client, scoped to the current user's session via cookies.
// Respects RLS — use this everywhere except the handful of places that
// must bypass RLS to read encrypted provider credentials (see admin.ts).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — the proxy is refreshing the
            // session instead, so writes here can be safely ignored.
          }
        },
      },
    }
  );
}
