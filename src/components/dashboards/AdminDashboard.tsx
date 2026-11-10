import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ClipboardList, UserX } from "lucide-react";
import { adminStatsQuery, adminUsersQuery, complaintsQuery, type CurrentUser } from "@/lib/queries";
import { friendlyError, STATUS_META, STATUS_ORDER } from "@/lib/complaints";
import { ComplaintList } from "@/components/ComplaintList";
import { ErrorState, PageHeader, StatCard } from "@/components/common";
import { STATUS_DOT } from "@/components/StatusBadge";
import { AssignControl } from "@/components/AssignControl";
import { cn } from "@/lib/utils";

export function AdminDashboard({ user: _user }: { user: CurrentUser }) {
  const stats = useQuery(adminStatsQuery());
  const list = useQuery(complaintsQuery({ kind: "all" }));
  const users = useQuery(adminUsersQuery());

  const staff = useMemo(
    () =>
      (users.data ?? [])
        .filter((u) => u.role === "staff")
        .map((u) => ({
          id: u.id,
          full_name: u.full_name || u.email,
          open_assigned: Number(u.open_assigned),
        })),
    [users.data],
  );

  const s = stats.data;
  const maxStatus = Math.max(1, ...STATUS_ORDER.map((k) => s?.by_status[k] ?? 0));
  const maxCat = Math.max(1, ...(s?.by_category ?? []).map((c) => c.count));

  return (
    <>
      <PageHeader
        eyebrow="Admin dashboard"
        title="Campus overview"
        description="Every complaint across campus, with assignment tools for your staff."
      />

      {stats.isError ? (
        <ErrorState message={friendlyError(stats.error)} onRetry={() => stats.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total complaints"
              value={s?.total ?? "—"}
              icon={ClipboardList}
              tone="primary"
            />
            <StatCard
              label="Unassigned & open"
              value={s?.unassigned ?? "—"}
              icon={UserX}
              tone="warning"
              hint="Need a staff member"
            />
            <StatCard label="New this week" value={s?.last_7_days ?? "—"} icon={CalendarClock} />
            <StatCard
              label="Resolved"
              value={s?.by_status.resolved ?? (s ? 0 : "—")}
              icon={CheckCircle2}
              tone="accent"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-lg font-semibold">By status</h2>
              <ul className="mt-4 space-y-3">
                {STATUS_ORDER.map((k) => {
                  const n = s?.by_status[k] ?? 0;
                  return (
                    <li
                      key={k}
                      className="grid grid-cols-[140px_1fr_36px] items-center gap-3 text-sm"
                    >
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span
                          className={cn("h-2 w-2 rounded-full", STATUS_DOT[k])}
                          aria-hidden="true"
                        />
                        {STATUS_META[k].label}
                      </span>
                      <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full rounded-full", STATUS_DOT[k])}
                          style={{ width: `${(n / maxStatus) * 100}%` }}
                        />
                      </span>
                      <span className="text-right font-semibold tabular-nums">{n}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-lg font-semibold">By category</h2>
              <ul className="mt-4 space-y-3">
                {(s?.by_category ?? []).map((c) => (
                  <li
                    key={c.name}
                    className="grid grid-cols-[140px_1fr_36px] items-center gap-3 text-sm"
                  >
                    <span className="truncate text-muted-foreground">{c.name}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${(c.count / maxCat) * 100}%` }}
                      />
                    </span>
                    <span className="text-right font-semibold tabular-nums">{c.count}</span>
                  </li>
                ))}
                {s && s.by_category.length === 0 && (
                  <li className="text-sm text-muted-foreground">No categories yet.</li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}

      <h2 className="mt-10 mb-4 text-2xl font-semibold">All complaints</h2>
      {list.isError ? (
        <ErrorState message={friendlyError(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <ComplaintList
          items={list.data}
          isLoading={list.isLoading}
          showStudent
          showAssignee
          enableCategoryFilter
          enableDateFilter
          enableAssigneeFilter
          renderAction={(c) => (
            <AssignControl complaintId={c.id} currentAssignee={c.assigned_to} staff={staff} />
          )}
          empty={{
            title: "No complaints yet",
            description: "Complaints submitted by students will show up here.",
          }}
        />
      )}
    </>
  );
}
