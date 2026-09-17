import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Topbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth — proxy.ts already redirects unauthenticated visitors
  // away from /dashboard/*, but a layout should never trust that alone.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="hidden w-56 shrink-0 border-r md:block">
        <SidebarNav />
      </aside>
      <div className="flex flex-1 flex-col">
        <Topbar email={user.email ?? ""} />
        <main className="flex-1 space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}
