import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type ComplaintStatus = Database["public"]["Enums"]["complaint_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type UpdateKind = Database["public"]["Enums"]["update_kind"];

export const STATUS_ORDER: ComplaintStatus[] = [
  "submitted",
  "assigned",
  "in_progress",
  "needs_info",
  "resolved",
  "rejected",
  "reopened",
];

export const STATUS_META: Record<ComplaintStatus, { label: string; description: string }> = {
  submitted: { label: "Submitted", description: "Waiting to be assigned" },
  assigned: { label: "Assigned", description: "A staff member has it" },
  in_progress: { label: "In Progress", description: "Work is underway" },
  needs_info: { label: "Needs Information", description: "Staff asked for more details" },
  resolved: { label: "Resolved", description: "The issue was fixed" },
  rejected: { label: "Rejected", description: "Closed without action" },
  reopened: { label: "Reopened", description: "Issue came back after resolution" },
};

export const OPEN_STATUSES: ComplaintStatus[] = [
  "submitted",
  "assigned",
  "in_progress",
  "needs_info",
  "reopened",
];

export const ROLE_LABEL: Record<AppRole, string> = {
  student: "Student",
  staff: "Staff",
  admin: "Admin",
};

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Returns an error message, or null when the file is an allowed photo. */
export function validateImage(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Photo must be a JPG, PNG or WebP image.";
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return "Photo must be 5 MB or smaller.";
  }
  if (file.size === 0) return "That file is empty.";
  return null;
}

export const complaintSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(120, "Title must be 120 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the issue in at least 10 characters")
    .max(4000, "Description must be 4000 characters or fewer"),
  categoryId: z.string().uuid("Please choose a category"),
  location: z
    .string()
    .trim()
    .min(2, "Please enter the building or location")
    .max(120, "Location must be 120 characters or fewer"),
  roomNumber: z.string().trim().max(30, "Room number must be 30 characters or fewer"),
});

export type ComplaintInput = z.infer<typeof complaintSchema>;

export const commentSchema = z
  .string()
  .trim()
  .min(1, "Write a message first")
  .max(2000, "Messages must be 2000 characters or fewer");

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/[0-9]/, "Include at least one number"),
});

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type FormErrors = {
  [K in
    | "form"
    | "title"
    | "description"
    | "categoryId"
    | "location"
    | "roomNumber"
    | "image"
    | "email"
    | "password"
    | "fullName"
    | "name"]?: string | undefined;
};

export function fieldErrors(error: z.ZodError): FormErrors {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out as FormErrors;
}

/** Turns backend errors into messages a person can act on. */
export function friendlyError(error: unknown): string {
  if (!error) return "Something went wrong. Please try again.";
  const e = error as { message?: string; code?: string };
  const msg = e.message ?? String(error);
  if (/row-level security|permission denied/i.test(msg)) {
    return "You don't have permission to do that.";
  }
  if (/duplicate key|already exists|categories_name_lower_idx/i.test(msg)) {
    return "That name is already in use.";
  }
  if (/violates foreign key constraint/i.test(msg)) {
    return "This item is still in use. Deactivate it instead.";
  }
  if (/Failed to fetch|NetworkError/i.test(msg)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return msg;
}
