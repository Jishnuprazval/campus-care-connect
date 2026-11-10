import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { adminUsersQuery } from "@/lib/queries";
import { friendlyError, ROLE_LABEL, type AppRole } from "@/lib/complaints";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, RestrictedNotice } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users & roles — Campus Complaint Tracker" },
      { name: "description", content: "Manage who is a student, staff member or admin." },
      { property: "og:title", content: "Users & roles — Campus Complaint Tracker" },
      { property: "og:description", content: "Manage who is a student, staff member or admin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

const ROLES: AppRole[] = ["student", "staff", "admin"];

function UsersPage() {
  const me = useCurrentUser();
  if (me.role !== "admin") return <RestrictedNotice />;
  return <UsersAdmin meId={me.id} />;
}

function UsersAdmin({ meId }: { meId: string }) {
  const q = useQuery(adminUsersQuery());
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [pending, setPending] = useState<{ id: string; name: string; from: AppRole; to: AppRole } | null>(null);

  const m = useMutation({
    mutationFn: async (p: { id: string; to: AppRole }) => {
      const { error } = await supabase.rpc("set_user_role", { _user_id: p.id, _role: p.to });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
    onSettled: () => setPending(null),
  });

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter(
      (u) =>
        (roleFilter === "all" || u.role === roleFilter) &&
        (!s || u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)),
    );
  }, [q.data, search, roleFilter]);

  const counts = useMemo(() => {
    const c = { student: 0, staff: 0, admin: 0 } as Record<AppRole, number>;
    for (const u of q.data ?? []) c[u.role]++;
    return c;
  }, [q.data]);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users & roles"
        description="Everyone who registers starts as a student. Promote people to staff so complaints can be assigned to them."
      />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:flex-row">
        <div className="relative flex-1">
          <Label htmlFor="u-search" className="sr-only">Search users</Label>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="u-search" className="pl-9" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppRole | "all")}>
          <SelectTrigger className="sm:w-56" aria-label="Filter by role"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles ({q.data?.length ?? 0})</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]} ({counts[r]})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <ListSkeleton />
      ) : q.isError ? (
        <ErrorState message={friendlyError(q.error)} onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description="Try a different search or role filter." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <ul className="divide-y">
            {rows.map((u) => {
              const isMe = u.id === meId;
              return (
                <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {u.full_name || "—"} {isMe && <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-xs">You</span>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    <span>Joined {format(new Date(u.created_at), "d MMM yyyy")}</span>
                    {u.role === "staff" && <span>{Number(u.open_assigned)} open assigned</span>}
                  </div>
                  <Select
                    value={u.role}
                    disabled={isMe || m.isPending}
                    onValueChange={(v) => setPending({ id: u.id, name: u.full_name || u.email, from: u.role, to: v as AppRole })}
                  >
                    <SelectTrigger className="sm:w-36" aria-label={`Role for ${u.full_name || u.email}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change role?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && (
                <>
                  {pending.name} will change from <strong>{ROLE_LABEL[pending.from]}</strong> to{" "}
                  <strong>{ROLE_LABEL[pending.to]}</strong>.
                  {pending.from === "staff" && " Reassign their open complaints so nothing gets stuck."}
                  {pending.to === "admin" && " Admins can see every complaint and manage all users."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pending && m.mutate({ id: pending.id, to: pending.to })}>
              Change role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
