import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  DoorOpen,
  Edit3,
  Loader2,
  MessageSquare,
  RotateCcw,
  Tag,
  Trash2,
  User,
  UserCheck,
  ArrowRightLeft,
  FilePlus2,
  PenLine,
  SearchX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  adminUsersQuery,
  categoriesQuery,
  complaintQuery,
  complaintUpdatesQuery,
  type ComplaintDetail,
} from "@/lib/queries";
import {
  commentSchema,
  complaintSchema,
  fieldErrors,
  friendlyError,
  ROLE_LABEL,
  STATUS_META,
  type ComplaintStatus,
  type FormErrors,
} from "@/lib/complaints";
import {
  allowedStatusTargets,
  canComment,
  canEditDetails,
  noteRequired,
  type Viewer,
} from "@/lib/workflow";
import { StatusBadge, STATUS_DOT, STATUS_ICON } from "@/components/StatusBadge";
import { AssignControl } from "@/components/AssignControl";
import { EmptyState, ErrorState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/complaints/$id")({
  head: () => ({
    meta: [
      { title: "Complaint details — Campus Complaint Tracker" },
      { name: "description", content: "Status, history and updates for a campus complaint." },
      { property: "og:title", content: "Complaint details — Campus Complaint Tracker" },
      {
        property: "og:description",
        content: "Status, history and updates for a campus complaint.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ComplaintPage,
});

function useInvalidateComplaint(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["complaint", id] });
    qc.invalidateQueries({ queryKey: ["complaint-updates", id] });
    qc.invalidateQueries({ queryKey: ["complaints"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };
}

function ComplaintPage() {
  const { id } = Route.useParams();
  const user = useCurrentUser();
  const q = useQuery(complaintQuery(id));

  if (q.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading complaint">
        <div className="h-40 animate-pulse rounded-2xl border bg-card" />
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="h-80 animate-pulse rounded-2xl border bg-card" />
          <div className="h-60 animate-pulse rounded-2xl border bg-card" />
        </div>
      </div>
    );
  }
  if (q.isError) return <ErrorState message={friendlyError(q.error)} onRetry={() => q.refetch()} />;
  if (!q.data) {
    return (
      <EmptyState
        icon={SearchX}
        title="Complaint not found"
        description="It may have been removed, or you don't have access to it."
        action={
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    );
  }

  const c = q.data;
  const viewer: Viewer = {
    role: user.role,
    isOwner: c.student_id === user.id,
    isAssigned: c.assigned_to === user.id,
  };

  return <ComplaintView c={c} viewer={viewer} />;
}

function ComplaintView({ c, viewer }: { c: ComplaintDetail; viewer: Viewer }) {
  const targets = allowedStatusTargets(viewer, c.status, !!c.assigned_to);
  const showStudentInfo = viewer.role !== "student";

  return (
    <>
      <Link
        to="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to dashboard
      </Link>

      <header className="rounded-2xl border bg-card p-5 shadow-card sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-sm font-medium text-primary">{c.tracking_number}</p>
            <h1 className="mt-1 text-2xl font-semibold break-words text-foreground sm:text-3xl">
              {c.title}
            </h1>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <StatusBadge status={c.status} size="lg" />
            <span className="text-xs text-muted-foreground">
              {STATUS_META[c.status].description}
            </span>
          </div>
        </div>
        <Lifecycle status={c.status} />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <section
            className="rounded-2xl border bg-card p-5 shadow-card sm:p-6"
            aria-labelledby="details-h"
          >
            <h2 id="details-h" className="text-lg font-semibold">
              Details
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-foreground/90">{c.description}</p>
            <dl className="mt-6 grid gap-x-6 gap-y-4 border-t pt-5 text-sm sm:grid-cols-2">
              <Meta icon={Tag} label="Category" value={c.category?.name ?? "—"} />
              <Meta icon={Building2} label="Location" value={c.location} />
              <Meta icon={DoorOpen} label="Room" value={c.room_number ?? "—"} />
              <Meta
                icon={UserCheck}
                label="Assigned to"
                value={c.assignee?.full_name ?? "Not assigned yet"}
              />
              {showStudentInfo && (
                <Meta
                  icon={User}
                  label="Submitted by"
                  value={c.student ? `${c.student.full_name} · ${c.student.email}` : "—"}
                />
              )}
              <Meta
                icon={CalendarDays}
                label="Submitted"
                value={format(new Date(c.created_at), "d MMM yyyy, HH:mm")}
              />
              <Meta
                icon={CalendarDays}
                label="Last updated"
                value={format(new Date(c.updated_at), "d MMM yyyy, HH:mm")}
              />
              {c.resolved_at && (
                <Meta
                  icon={CalendarDays}
                  label="Resolved"
                  value={format(new Date(c.resolved_at), "d MMM yyyy, HH:mm")}
                />
              )}
            </dl>
          </section>

          {c.image_path && <Photo path={c.image_path} />}

          <Timeline complaintId={c.id} />
          {canComment(viewer) && <ReplyBox c={c} viewer={viewer} />}
        </div>

        <aside className="space-y-4" aria-label="Actions">
          {viewer.role === "admin" && <AdminAssignCard c={c} />}
          {targets.length > 0 && viewer.isOwner && viewer.role === "student" ? (
            <ReopenCard c={c} />
          ) : targets.length > 0 ? (
            <StatusCard c={c} targets={targets} />
          ) : null}
          {canEditDetails(viewer, c.status) && <EditCard c={c} />}
          {viewer.role === "admin" && <DeleteCard c={c} />}
          {viewer.role === "student" && c.status === "rejected" && (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              This complaint was closed without action. See the history for the reason. You can
              still add a reply.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

const MAIN_FLOW: ComplaintStatus[] = ["submitted", "assigned", "in_progress", "resolved"];

function Lifecycle({ status }: { status: ComplaintStatus }) {
  const mapped: ComplaintStatus =
    status === "needs_info"
      ? "in_progress"
      : status === "reopened"
        ? "assigned"
        : status === "rejected"
          ? "resolved"
          : status;
  const idx = MAIN_FLOW.indexOf(mapped);
  return (
    <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Progress">
      {MAIN_FLOW.map((s, i) => {
        const done = i <= idx;
        const label = s === "resolved" && status === "rejected" ? "Rejected" : STATUS_META[s].label;
        return (
          <li key={s} className="min-w-0">
            <span
              className={cn(
                "block h-1.5 rounded-full",
                done
                  ? status === "rejected" && i === 3
                    ? "bg-status-rejected"
                    : "bg-primary"
                  : "bg-muted",
              )}
            />
            <span
              className={cn(
                "mt-2 block truncate text-xs",
                done ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium break-words text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function Photo({ path }: { path: string }) {
  const q = useQuery({
    queryKey: ["photo", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("complaint-images")
        .createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 50 * 60 * 1000,
  });
  return (
    <section
      className="rounded-2xl border bg-card p-5 shadow-card sm:p-6"
      aria-labelledby="photo-h"
    >
      <h2 id="photo-h" className="text-lg font-semibold">
        Photo
      </h2>
      <div className="mt-3">
        {q.isLoading ? (
          <div className="aspect-video animate-pulse rounded-xl bg-muted" />
        ) : q.data ? (
          <a href={q.data} target="_blank" rel="noreferrer">
            <img
              src={q.data}
              alt="Photo attached to the complaint"
              className="max-h-[420px] w-full rounded-xl object-contain bg-muted"
            />
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">The photo couldn't be loaded.</p>
        )}
      </div>
    </section>
  );
}

function Timeline({ complaintId }: { complaintId: string }) {
  const q = useQuery(complaintUpdatesQuery(complaintId));
  return (
    <section
      className="rounded-2xl border bg-card p-5 shadow-card sm:p-6"
      aria-labelledby="history-h"
    >
      <h2 id="history-h" className="text-lg font-semibold">
        History
      </h2>
      {q.isLoading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : q.isError ? (
        <p className="mt-3 text-sm text-destructive">{friendlyError(q.error)}</p>
      ) : (
        <ol className="relative mt-5 space-y-6 border-l pl-6">
          {(q.data ?? []).map((u) => {
            const Icon =
              u.kind === "comment"
                ? MessageSquare
                : u.kind === "assignment"
                  ? ArrowRightLeft
                  : u.kind === "created"
                    ? FilePlus2
                    : u.kind === "edit"
                      ? PenLine
                      : u.to_status
                        ? STATUS_ICON[u.to_status]
                        : RotateCcw;
            return (
              <li key={u.id} className="relative">
                <span
                  className={cn(
                    "absolute top-0.5 -left-[35px] grid h-6 w-6 place-items-center rounded-full border-2 border-card text-primary-foreground",
                    u.kind === "status_change" && u.to_status
                      ? STATUS_DOT[u.to_status]
                      : u.kind === "comment"
                        ? "bg-accent text-accent-foreground"
                        : "bg-primary",
                  )}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold text-foreground">{u.author_name}</span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                    {ROLE_LABEL[u.author_role]}
                  </span>
                  <span className="text-muted-foreground">{describeUpdate(u)}</span>
                </div>
                {(u.kind === "status_change" || u.kind === "assignment") &&
                  u.from_status &&
                  u.to_status && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={u.from_status} />
                      <span aria-hidden="true" className="text-muted-foreground">
                        →
                      </span>
                      <span className="sr-only">to</span>
                      <StatusBadge status={u.to_status} />
                    </div>
                  )}
                {u.body && u.kind !== "edit" && u.kind !== "assignment" && (
                  <p
                    className={cn(
                      "mt-2 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                      u.kind === "comment" ? "bg-secondary" : "border bg-background",
                    )}
                  >
                    {u.body}
                  </p>
                )}
                <time
                  dateTime={u.created_at}
                  className="mt-1.5 block text-xs text-muted-foreground"
                  title={format(new Date(u.created_at), "PPpp")}
                >
                  {format(new Date(u.created_at), "d MMM yyyy, HH:mm")} ·{" "}
                  {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function describeUpdate(u: {
  kind: string;
  to_status: ComplaintStatus | null;
  assigned_to_name: string | null;
  body: string | null;
}) {
  switch (u.kind) {
    case "created":
      return "submitted the complaint";
    case "comment":
      return "added a message";
    case "edit":
      return "updated the complaint details";
    case "assignment":
      return `${u.body === "Reassigned" ? "reassigned it" : "assigned it"} to ${u.assigned_to_name ?? "staff"}`;
    case "status_change":
      return u.to_status
        ? `changed the status to ${STATUS_META[u.to_status].label}`
        : "changed the status";
    default:
      return "";
  }
}

function ReplyBox({ c, viewer }: { c: ComplaintDetail; viewer: Viewer }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidateComplaint(c.id);
  const m = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.rpc("add_complaint_comment", {
        _complaint_id: c.id,
        _body: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      toast.success("Message added");
      invalidate();
    },
    onError: (e) => setError(friendlyError(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Write a message first");
      return;
    }
    setError(null);
    m.mutate(parsed.data);
  }

  const isStudent = viewer.isOwner && viewer.role === "student";
  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-2xl border bg-card p-5 shadow-card sm:p-6"
    >
      <Label htmlFor="reply" className="text-lg font-semibold font-display">
        {isStudent ? "Reply" : "Add a progress update"}
      </Label>
      {isStudent && c.status === "needs_info" && (
        <p className="mt-2 rounded-lg bg-status-needs-info/10 px-3 py-2 text-sm text-status-needs-info">
          Staff asked for more information. Your reply will send the complaint back to them.
        </p>
      )}
      <Textarea
        id="reply"
        rows={4}
        className="mt-3"
        value={body}
        maxLength={2000}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          isStudent
            ? "Add details or reply to staff…"
            : "Describe progress, next steps or what you need…"
        }
        aria-invalid={!!error}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p
          className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}
          role={error ? "alert" : undefined}
        >
          {error ?? `${body.length}/2000`}
        </p>
        <Button type="submit" disabled={m.isPending}>
          {m.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isStudent ? "Send reply" : "Post update"}
        </Button>
      </div>
    </form>
  );
}

function StatusCard({ c, targets }: { c: ComplaintDetail; targets: ComplaintStatus[] }) {
  const [target, setTarget] = useState<ComplaintStatus | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const invalidate = useInvalidateComplaint(c.id);

  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("change_complaint_status", {
        _complaint_id: c.id,
        _status: target as ComplaintStatus,
        ...(note.trim() ? { _note: note.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Status changed to ${STATUS_META[target as ComplaintStatus].label}`);
      setTarget("");
      setNote("");
      invalidate();
    },
    onError: (e) => setError(friendlyError(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!target) return setError("Choose a new status");
    if (noteRequired(target) && !note.trim())
      return setError("Please add a note explaining this change");
    if (note.length > 2000) return setError("Notes must be 2000 characters or fewer");
    setError(null);
    if (target === "rejected") setConfirmOpen(true);
    else m.mutate();
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border bg-card p-5 shadow-card">
      <h2 className="text-lg font-semibold">Update status</h2>
      <p className="mt-1 text-sm text-muted-foreground">Current: {STATUS_META[c.status].label}</p>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-status">New status</Label>
          <Select value={target} onValueChange={(v) => setTarget(v as ComplaintStatus)}>
            <SelectTrigger id="new-status" className="w-full">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "needs_info" ? "Request more information" : STATUS_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status-note">
            Note to student {target && noteRequired(target) ? "*" : "(optional)"}
          </Label>
          <Textarea
            id="status-note"
            rows={3}
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              target === "needs_info"
                ? "What information do you need?"
                : target === "rejected"
                  ? "Why is this being rejected?"
                  : "Optional details"
            }
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full"
          variant={target === "rejected" ? "destructive" : "default"}
          disabled={m.isPending}
        >
          {m.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {target === "resolved"
            ? "Mark as resolved"
            : target === "rejected"
              ? "Reject complaint"
              : "Update status"}
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this complaint?</AlertDialogTitle>
            <AlertDialogDescription>
              {c.tracking_number} will be closed without action. The student will see your note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => m.mutate()}
            >
              Reject complaint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function ReopenCard({ c }: { c: ComplaintDetail }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const invalidate = useInvalidateComplaint(c.id);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("change_complaint_status", {
        _complaint_id: c.id,
        _status: "reopened",
        _note: note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Complaint reopened");
      setNote("");
      invalidate();
    },
    onError: (e) => setError(friendlyError(e)),
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) return setError("Tell staff what's still wrong");
        setError(null);
        setConfirmOpen(true);
      }}
      className="rounded-2xl border border-status-reopened/30 bg-card p-5 shadow-card"
    >
      <h2 className="text-lg font-semibold">Still not fixed?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Reopen the complaint and it goes back to staff.
      </p>
      <Label htmlFor="reopen-note" className="mt-4 block">
        What's still happening? *
      </Label>
      <Textarea
        id="reopen-note"
        rows={3}
        className="mt-1.5"
        value={note}
        maxLength={2000}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" className="mt-3 w-full" disabled={m.isPending}>
        {m.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        )}
        Reopen complaint
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen {c.tracking_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              The complaint will move back to staff with your note.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => m.mutate()}>Reopen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function AdminAssignCard({ c }: { c: ComplaintDetail }) {
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
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <h2 className="text-lg font-semibold">{c.assigned_to ? "Reassign" : "Assign to staff"}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {c.assignee ? `Currently with ${c.assignee.full_name}.` : "No one is working on this yet."}
      </p>
      <AssignControl
        className="mt-4"
        complaintId={c.id}
        currentAssignee={c.assigned_to}
        staff={staff}
      />
      {users.isSuccess && staff.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No staff accounts yet. Give someone the Staff role in{" "}
          <Link to="/admin/users" className="underline">
            Users & roles
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function EditCard({ c }: { c: ComplaintDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <h2 className="text-lg font-semibold">Edit details</h2>
      <p className="mt-1 text-sm text-muted-foreground">Fix a typo or add missing location info.</p>
      <Button variant="outline" className="mt-4 w-full" onClick={() => setOpen(true)}>
        <Edit3 className="h-4 w-4" aria-hidden="true" /> Edit complaint
      </Button>
      {open && <EditDialog c={c} onClose={() => setOpen(false)} />}
    </div>
  );
}

function EditDialog({ c, onClose }: { c: ComplaintDetail; onClose: () => void }) {
  const cats = useQuery(categoriesQuery());
  const invalidate = useInvalidateComplaint(c.id);
  const [form, setForm] = useState({
    title: c.title,
    description: c.description,
    categoryId: c.category_id,
    location: c.location,
    roomNumber: c.room_number ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const m = useMutation({
    mutationFn: async (v: typeof form) => {
      const { error } = await supabase.rpc("edit_complaint", {
        _complaint_id: c.id,
        _title: v.title,
        _description: v.description,
        _category_id: v.categoryId,
        _location: v.location,
        _room_number: v.roomNumber,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Details updated");
      invalidate();
      onClose();
    },
    onError: (e) => setErrors({ form: friendlyError(e) }),
  });

  const options = (cats.data ?? []).filter((x) => x.is_active || x.id === c.category_id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {c.tracking_number}</DialogTitle>
          <DialogDescription>Changes are recorded in the history.</DialogDescription>
        </DialogHeader>
        <form
          id="edit-form"
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = complaintSchema.safeParse(form);
            if (!parsed.success) return setErrors(fieldErrors(parsed.error));
            setErrors({});
            m.mutate({ ...parsed.data });
          }}
        >
          {errors.form && (
            <p className="text-sm text-destructive" role="alert">
              {errors.form}
            </p>
          )}
          <EF id="e-title" label="Title" error={errors.title}>
            <Input
              id="e-title"
              value={form.title}
              maxLength={120}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </EF>
          <EF id="e-desc" label="Description" error={errors.description}>
            <Textarea
              id="e-desc"
              rows={5}
              value={form.description}
              maxLength={4000}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </EF>
          <EF id="e-cat" label="Category" error={errors.categoryId}>
            <Select
              value={form.categoryId}
              onValueChange={(v) => setForm({ ...form, categoryId: v })}
            >
              <SelectTrigger id="e-cat" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EF>
          <div className="grid gap-4 sm:grid-cols-2">
            <EF id="e-loc" label="Building / location" error={errors.location}>
              <Input
                id="e-loc"
                value={form.location}
                maxLength={120}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </EF>
            <EF id="e-room" label="Room number" error={errors.roomNumber}>
              <Input
                id="e-room"
                value={form.roomNumber}
                maxLength={30}
                onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
              />
            </EF>
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-form" disabled={m.isPending}>
            {m.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EF({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function DeleteCard({ c }: { c: ComplaintDetail }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("complaints").delete().eq("id", c.id);
      if (error) throw error;
      if (c.image_path) await supabase.storage.from("complaint-images").remove([c.image_path]);
    },
    onSuccess: () => {
      toast.success(`${c.tracking_number} deleted`);
      qc.invalidateQueries({ queryKey: ["complaints"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.removeQueries({ queryKey: ["complaint", c.id] });
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-destructive/20 bg-card p-5 shadow-card">
      <h2 className="text-lg font-semibold">Danger zone</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently remove this complaint and its history.
      </p>
      <Button
        variant="outline"
        className="mt-4 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={m.isPending}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete complaint
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {c.tracking_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the complaint, its photo and its full history. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => m.mutate()}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
