import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, LogOut, PlusCircle, Tags, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ROLE_LABEL } from "@/lib/complaints";
import { BrandMark } from "./BrandMark";
import { Button } from "@/components/ui/button";

const navLink =
  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground whitespace-nowrap";
const navActive = "bg-secondary text-foreground";

export function AppShell() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <BrandMark to="/dashboard" />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            <NavItems role={user.role} />
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-[180px] truncate text-sm font-semibold text-foreground">
                {user.fullName}
              </p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </Button>
          </div>
        </div>
        <nav
          aria-label="Main mobile"
          className="flex gap-1 overflow-x-auto border-t px-3 py-2 md:hidden"
        >
          <NavItems role={user.role} />
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}

function NavItems({ role }: { role: "student" | "staff" | "admin" }) {
  return (
    <>
      <Link to="/dashboard" className={navLink} activeProps={{ className: navActive }}>
        <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
        Dashboard
      </Link>
      {role === "student" && (
        <Link to="/complaints/new" className={navLink} activeProps={{ className: navActive }}>
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          New complaint
        </Link>
      )}
      {role === "admin" && (
        <>
          <Link to="/admin/users" className={navLink} activeProps={{ className: navActive }}>
            <Users className="h-4 w-4" aria-hidden="true" />
            Users & roles
          </Link>
          <Link to="/admin/categories" className={navLink} activeProps={{ className: navActive }}>
            <Tags className="h-4 w-4" aria-hidden="true" />
            Categories
          </Link>
        </>
      )}
    </>
  );
}
