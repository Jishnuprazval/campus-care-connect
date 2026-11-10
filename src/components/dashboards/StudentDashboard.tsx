import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, HelpCircle, Plus, Timer } from "lucide-react";
import { complaintsQuery, type CurrentUser } from "@/lib/queries";
import {
  friendlyError,
  OPEN_STATUSES,
  STATUS_META,
  STATUS_ORDER,
  type ComplaintStatus,
} from "@/lib/complaints";
import { Button } from "@/components/ui/button";
import { ComplaintList } from "@/components/ComplaintList";
import { ErrorState, PageHeader, StatCard } from "@/components/common";
import { STATUS_DOT } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

export function StudentDashboard({ user }: { user: CurrentUser }) {
  const q = useQuery(complaintsQuery({ kind: "student", userId: user.id }));
  const [status, setStatus] = useState<ComplaintStatus | "all">("all");
  const items = q.data ?? [];
  const count = (s: ComplaintStatus) => items.filter((c) => c.status === s).length;
  const open = items.filter((c) => OPEN_STATUSES.includes(c.status)).length;

  const submit = (
    <Button asChild size="lg">
      <Link to="/complaints/new">
        <Plus className="h-4 w-4" aria-hidden="true" /> Submit a complaint
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow="Student dashboard"
        title={`Hi, ${user.fullName.split(" ")[0]}`}
        description="Report campus issues and follow them until they're fixed."
        actions={submit}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total complaints"
          value={items.length}
          icon={ClipboardList}
          tone="primary"
          onClick={() => setStatus("all")}
          active={status === "all"}
        />
        <StatCard label="Open" value={open} icon={Timer} hint="Not yet resolved" />
        <StatCard
          label="Needs your input"
          value={count("needs_info")}
          icon={HelpCircle}
          tone="warning"
          onClick={() => setStatus("needs_info")}
          active={status === "needs_info"}
        />
        <StatCard
          label="Resolved"
          value={count("resolved")}
          icon={CheckCircle2}
          tone="accent"
          onClick={() => setStatus("resolved")}
          active={status === "resolved"}
        />
      </div>

      <div className="mt-4 mb-8 flex flex-wrap gap-2" aria-label="Counts by status">
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(status === s ? "all" : s)}
            aria-pressed={status === s}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring",
              status === s && "border-primary ring-2 ring-primary/20",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} aria-hidden="true" />
            {STATUS_META[s].label}
            <span className="font-semibold tabular-nums">{count(s)}</span>
          </button>
        ))}
      </div>

      {q.isError ? (
        <ErrorState message={friendlyError(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <ComplaintList
          items={q.data}
          isLoading={q.isLoading}
          status={status}
          onStatusChange={setStatus}
          empty={{
            title: "No complaints yet",
            description: "Spotted something broken on campus? Report it and track the fix here.",
            action: submit,
          }}
        />
      )}
    </>
  );
}
