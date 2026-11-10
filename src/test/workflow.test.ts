import { describe, expect, it } from "vitest";
import { allowedStatusTargets, canComment, canEditDetails, noteRequired } from "@/lib/workflow";
import { validateImage, IMAGE_MAX_BYTES } from "@/lib/complaints";

const student = { role: "student" as const, isOwner: true, isAssigned: false };
const otherStudent = { role: "student" as const, isOwner: false, isAssigned: false };
const assignedStaff = { role: "staff" as const, isOwner: false, isAssigned: true };
const otherStaff = { role: "staff" as const, isOwner: false, isAssigned: false };
const admin = { role: "admin" as const, isOwner: false, isAssigned: false };

describe("status permissions", () => {
  it("lets a student only reopen their own resolved complaint", () => {
    expect(allowedStatusTargets(student, "resolved", true)).toEqual(["reopened"]);
    expect(allowedStatusTargets(student, "in_progress", true)).toEqual([]);
    expect(allowedStatusTargets(otherStudent, "resolved", true)).toEqual([]);
  });

  it("lets assigned staff move work forward, ask for info, resolve or reject", () => {
    expect(allowedStatusTargets(assignedStaff, "assigned", true)).toEqual([
      "in_progress",
      "needs_info",
      "resolved",
      "rejected",
    ]);
    expect(allowedStatusTargets(assignedStaff, "resolved", true)).toEqual([]);
  });

  it("gives staff no controls on complaints not assigned to them", () => {
    expect(allowedStatusTargets(otherStaff, "assigned", true)).toEqual([]);
    expect(canComment(otherStaff)).toBe(false);
  });

  it("lets admins set any status but Assigned needs a staff member", () => {
    expect(allowedStatusTargets(admin, "submitted", false)).not.toContain("assigned");
    expect(allowedStatusTargets(admin, "submitted", true)).toContain("assigned");
  });

  it("requires a note when rejecting, requesting info or reopening", () => {
    expect(noteRequired("rejected")).toBe(true);
    expect(noteRequired("needs_info")).toBe(true);
    expect(noteRequired("reopened")).toBe(true);
    expect(noteRequired("resolved")).toBe(false);
  });

  it("lets students edit details only while the complaint is still Submitted", () => {
    expect(canEditDetails(student, "submitted")).toBe(true);
    expect(canEditDetails(student, "assigned")).toBe(false);
    expect(canEditDetails(admin, "in_progress")).toBe(true);
  });
});

describe("photo attachments", () => {
  it("accepts JPG, PNG and WebP up to 5 MB", () => {
    expect(validateImage({ type: "image/jpeg", size: IMAGE_MAX_BYTES })).toBeNull();
    expect(validateImage({ type: "image/webp", size: 1000 })).toBeNull();
  });
  it("rejects other file types and files over 5 MB", () => {
    expect(validateImage({ type: "application/pdf", size: 1000 })).not.toBeNull();
    expect(validateImage({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).not.toBeNull();
  });
});
