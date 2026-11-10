import type { AppRole, ComplaintStatus } from "./complaints";
import { STATUS_ORDER } from "./complaints";

/*
 * Mirrors the permission rules enforced in the database functions so the UI only
 * offers actions that will succeed. The database remains the source of truth.
 */

export type Viewer = {
  role: AppRole;
  isOwner: boolean;
  isAssigned: boolean;
};

const STAFF_WORKABLE: ComplaintStatus[] = ["assigned", "in_progress", "needs_info", "reopened"];
const STAFF_TARGETS: ComplaintStatus[] = ["in_progress", "needs_info", "resolved", "rejected"];

export function allowedStatusTargets(
  viewer: Viewer,
  current: ComplaintStatus,
  hasAssignee: boolean,
): ComplaintStatus[] {
  if (viewer.role === "admin") {
    return STATUS_ORDER.filter((s) => s !== current && (s !== "assigned" || hasAssignee));
  }
  if (viewer.role === "staff" && viewer.isAssigned) {
    if (!STAFF_WORKABLE.includes(current)) return [];
    return STAFF_TARGETS.filter((s) => s !== current);
  }
  if (viewer.isOwner && current === "resolved") return ["reopened"];
  return [];
}

/** Rejecting, asking for info and reopening all need an explanation. */
export function noteRequired(target: ComplaintStatus): boolean {
  return target === "rejected" || target === "needs_info" || target === "reopened";
}

export function canComment(viewer: Viewer): boolean {
  return viewer.isOwner || viewer.role === "admin" || (viewer.role === "staff" && viewer.isAssigned);
}

export function canEditDetails(viewer: Viewer, current: ComplaintStatus): boolean {
  return viewer.role === "admin" || (viewer.isOwner && current === "submitted");
}
