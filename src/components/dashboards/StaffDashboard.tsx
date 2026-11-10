import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, CheckCircle2, HelpCircle, Loader } from "lucide-react";
import { complaintsQuery, type CurrentUser } from "@/lib/queries";
import { friendlyError, OPEN_STATUSES, type ComplaintStatus } from "@/lib/complaints";
import { ComplaintList } from "@/components/ComplaintList";
import { ErrorState, PageHeader, StatCard } from "@/components/common";

export function StaffDashboard({ user }: { user: CurrentUser }) {
  const q = useQuery(complaintsQuery({ kind: "staff", userId: user.id }));
  const [status, setStatus] = useState<ComplaintStatus | "all">("all");
  const items = q.data ?? [];
  const count = (s: ComplaintStatus) => items.filter((c) => c.status === s).length;
  const open = items.filter((c) => OPEN_STATUSES.includes(c.status)).length;
  const toStart = count("assigned") + count("reopened");

  return (
    <>
      <PageHeader
        eyebrow="Staff dashboard"
        title="Assigned to you"
        description="Pick up new complaints, post progress and close them out."
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open workload" value={open} icon={Briefcase} tone="primary" onClick={() => setStatus("all")} active={status === "all"} hint={`${toStart} waiting to start`} />
        <StatCard label="In progress" value={count("in_progress")} icon={Loader} onClick={() => setStatus("in_progress")} active={status === "in_progress"} />
        <StatCard label="Awaiting student" value={count("needs_info")} icon={HelpCircle} tone="warning" onClick={() => setStatus("needs_info")} active={status === "needs_info"} />
        <StatCard label="Resolved" value={count("resolved")} icon={CheckCircle2} tone="accent" onClick={() => setStatus("resolved")} active={status === "resolved"} />
      </div>

      {q.isError ? (
        <ErrorState message={friendlyError(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <ComplaintList
          items={q.data}
          isLoading={q.isLoading}
          status={status}
          onStatusChange={setStatus}
          showStudent
          enableCategoryFilter
          enableDateFilter
          empty={{
            title: "Nothing assigned to you",
            description: "When an admin assigns a complaint to you, it will appear here.",
          }}
        />
      )}
    </>
  );
}
