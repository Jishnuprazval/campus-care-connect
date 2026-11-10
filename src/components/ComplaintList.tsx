import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { MapPin, Search, Tag, User, UserCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_META, STATUS_ORDER, type ComplaintStatus } from "@/lib/complaints";
import type { ComplaintListItem } from "@/lib/queries";
import { StatusBadge } from "./StatusBadge";
import { EmptyState, ListSkeleton } from "./common";

type Props = {
  items: ComplaintListItem[] | undefined;
  isLoading?: boolean;
  status?: ComplaintStatus | "all";
  onStatusChange?: (s: ComplaintStatus | "all") => void;
  showStudent?: boolean;
  showAssignee?: boolean;
  enableCategoryFilter?: boolean;
  enableDateFilter?: boolean;
  enableAssigneeFilter?: boolean;
  renderAction?: (item: ComplaintListItem) => ReactNode;
  empty: { title: string; description?: string | undefined; action?: ReactNode };
};

export function ComplaintList({
  items,
  isLoading,
  status: controlledStatus,
  onStatusChange,
  showStudent,
  showAssignee,
  enableCategoryFilter,
  enableDateFilter,
  enableAssigneeFilter,
  renderAction,
  empty,
}: Props) {
  const [query, setQuery] = useState("");
  const [localStatus, setLocalStatus] = useState<ComplaintStatus | "all">("all");
  const [category, setCategory] = useState("all");
  const [assignee, setAssignee] = useState<"all" | "unassigned" | "assigned">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const status = controlledStatus ?? localStatus;
  const setStatus = onStatusChange ?? setLocalStatus;

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of items ?? []) if (c.category) map.set(c.category.id, c.category.name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : null;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : null;
    const out = (items ?? []).filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (category !== "all" && c.category?.id !== category) return false;
      if (assignee === "unassigned" && c.assigned_to) return false;
      if (assignee === "assigned" && !c.assigned_to) return false;
      const created = new Date(c.created_at).getTime();
      if (fromTs && created < fromTs) return false;
      if (toTs && created > toTs) return false;
      if (q) {
        const hay = [c.tracking_number, c.title, c.location, c.room_number, c.category?.name, c.student?.full_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out.sort((a, b) => {
      const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sort === "newest" ? -d : d;
    });
    return out;
  }, [items, query, status, category, assignee, from, to, sort]);

  const hasFilters =
    query !== "" || status !== "all" || category !== "all" || assignee !== "all" || from !== "" || to !== "";

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setCategory("all");
    setAssignee("all");
    setFrom("");
    setTo("");
  }

  return (
    <section aria-label="Complaints">
      <div className="mb-4 grid gap-3 rounded-xl border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-12">
        <div className="relative sm:col-span-2 lg:col-span-4">
          <Label htmlFor="cl-search" className="sr-only">Search complaints</Label>
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="cl-search"
            placeholder="Search by tracking no., title or location"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as ComplaintStatus | "all")}
          className="lg:col-span-2"
          options={[{ value: "all", label: "All statuses" }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))]}
        />
        {enableCategoryFilter && (
          <FilterSelect
            label="Category"
            value={category}
            onChange={setCategory}
            className="lg:col-span-2"
            options={[{ value: "all", label: "All categories" }, ...categories.map(([id, name]) => ({ value: id, label: name }))]}
          />
        )}
        {enableAssigneeFilter && (
          <FilterSelect
            label="Assignment"
            value={assignee}
            onChange={(v) => setAssignee(v as typeof assignee)}
            className="lg:col-span-2"
            options={[
              { value: "all", label: "Anyone" },
              { value: "unassigned", label: "Unassigned" },
              { value: "assigned", label: "Assigned" },
            ]}
          />
        )}
        <FilterSelect
          label="Sort"
          value={sort}
          onChange={(v) => setSort(v as "newest" | "oldest")}
          className="lg:col-span-2"
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
          ]}
        />
        {enableDateFilter && (
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-4">
            <div className="space-y-1">
              <Label htmlFor="cl-from" className="text-xs text-muted-foreground">From</Label>
              <Input id="cl-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cl-to" className="text-xs text-muted-foreground">To</Label>
              <Input id="cl-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
        <p aria-live="polite">
          {isLoading ? "Loading…" : `Showing ${filtered.length} of ${items?.length ?? 0}`}
        </p>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" aria-hidden="true" /> Clear filters
          </Button>
        )}
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : (items?.length ?? 0) === 0 ? (
        <EmptyState title={empty.title} description={empty.description} action={empty.action} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No complaints match these filters"
          description="Try a different search or clear the filters."
          action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id} className="rounded-xl border bg-card shadow-card transition hover:border-primary/40">
              <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-6">
                <Link
                  to="/complaints/$id"
                  params={{ id: c.id }}
                  className="min-w-0 flex-1 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono font-medium text-foreground/80">{c.tracking_number}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={c.created_at}>{format(new Date(c.created_at), "d MMM yyyy")}</time>
                  </div>
                  <p className="mt-1 truncate font-semibold text-foreground">{c.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                      {c.category?.name ?? "Uncategorized"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      {c.location}
                      {c.room_number ? `, ${c.room_number}` : ""}
                    </span>
                    {showStudent && c.student && (
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" aria-hidden="true" />
                        {c.student.full_name}
                      </span>
                    )}
                    {showAssignee && (
                      <span className="inline-flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        {c.assignee?.full_name ?? "Unassigned"}
                      </span>
                    )}
                  </div>
                </Link>
                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  <StatusBadge status={c.status} />
                  {renderAction?.(c)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
