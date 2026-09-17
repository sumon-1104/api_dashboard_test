import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export function Topbar({ email }: { email: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <span className="text-sm font-medium">AI API Usage Dashboard</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{email}</span>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
