import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// RLS already scopes this to the caller's own projects — no explicit
// .eq("user_id", ...) needed, but it doesn't hurt to be exact about intent.
export async function GET() {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ projects: data });
}

const createSchema = z.object({ name: z.string().min(1) });

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("unauthorized" in auth) return auth.unauthorized;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ name: parsed.data.name, user_id: auth.user.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ project: data }, { status: 201 });
}
