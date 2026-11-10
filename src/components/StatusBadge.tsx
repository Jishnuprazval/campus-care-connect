import {
  CircleDot,
  UserCheck,
  Loader,
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_META, type ComplaintStatus } from "@/lib/complaints";

export const STATUS_ICON: Record<ComplaintStatus, LucideIcon> = {
  submitted: CircleDot,
  assigned: UserCheck,
  in_progress: Loader,
  needs_info: HelpCircle,
  resolved: CheckCircle2,
  rejected: XCircle,
  reopened: RotateCcw,
};

// Full class strings so Tailwind can see every status color.
export const STATUS_CLASSES: Record<ComplaintStatus, string> = {
  submitted: "bg-status-submitted/10 text-status-submitted border-status-submitted/30",
  assigned: "bg-status-assigned/10 text-status-assigned border-status-assigned/30",
  in_progress: "bg-status-in-progress/10 text-status-in-progress border-status-in-progress/30",
  needs_info: "bg-status-needs-info/10 text-status-needs-info border-status-needs-info/30",
  resolved: "bg-status-resolved/10 text-status-resolved border-status-resolved/30",
  rejected: "bg-status-rejected/10 text-status-rejected border-status-rejected/30",
  reopened: "bg-status-reopened/10 text-status-reopened border-status-reopened/30",
};

export const STATUS_DOT: Record<ComplaintStatus, string> = {
  submitted: "bg-status-submitted",
  assigned: "bg-status-assigned",
  in_progress: "bg-status-in-progress",
  needs_info: "bg-status-needs-info",
  resolved: "bg-status-resolved",
  rejected: "bg-status-rejected",
  reopened: "bg-status-reopened",
};

export function StatusBadge({
  status,
  className,
  size = "sm",
}: {
  status: ComplaintStatus;
  className?: string;
  size?: "sm" | "lg";
}) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3.5 py-1.5 text-sm",
        STATUS_CLASSES[status],
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
      {STATUS_META[status].label}
    </span>
  );
}
