import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, ComplaintStatus } from "./complaints";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

export const currentUserQuery = () =>
  queryOptions({
    queryKey: ["current-user"],
    queryFn: async (): Promise<CurrentUser | null> => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      const uid = data.user.id;
      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      ]);
      return {
        id: uid,
        email: profileRes.data?.email || data.user.email || "",
        fullName: profileRes.data?.full_name || data.user.email || "User",
        role: roleRes.data?.role ?? "student",
      };
    },
    staleTime: 60_000,
  });

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, description, is_active, created_at")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

const LIST_SELECT =
  "id, tracking_number, title, location, room_number, status, created_at, updated_at, student_id, assigned_to, category:categories(id, name), assignee:profiles!complaints_assigned_to_fkey(id, full_name), student:profiles!complaints_student_id_fkey(id, full_name)";

export type ListScope = { kind: "student" | "staff"; userId: string } | { kind: "all" };

async function fetchComplaints(scope: ListScope) {
  let q = supabase.from("complaints").select(LIST_SELECT).order("created_at", { ascending: false });
  if (scope.kind === "student") q = q.eq("student_id", scope.userId);
  if (scope.kind === "staff") q = q.eq("assigned_to", scope.userId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export type ComplaintListItem = Awaited<ReturnType<typeof fetchComplaints>>[number];

export const complaintsQuery = (scope: ListScope) =>
  queryOptions({
    queryKey: ["complaints", scope.kind, scope.kind === "all" ? "" : scope.userId],
    queryFn: () => fetchComplaints(scope),
  });

async function fetchComplaint(id: string) {
  const { data, error } = await supabase
    .from("complaints")
    .select(
      "id, tracking_number, title, description, location, room_number, image_path, status, created_at, updated_at, resolved_at, student_id, assigned_to, category_id, category:categories(id, name), assignee:profiles!complaints_assigned_to_fkey(id, full_name, email), student:profiles!complaints_student_id_fkey(id, full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type ComplaintDetail = NonNullable<Awaited<ReturnType<typeof fetchComplaint>>>;

export const complaintQuery = (id: string) =>
  queryOptions({ queryKey: ["complaint", id], queryFn: () => fetchComplaint(id) });

export const complaintUpdatesQuery = (id: string) =>
  queryOptions({
    queryKey: ["complaint-updates", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaint_updates")
        .select("id, kind, body, from_status, to_status, assigned_to_name, author_name, author_role, created_at")
        .eq("complaint_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

export type AdminStats = {
  total: number;
  unassigned: number;
  last_7_days: number;
  by_status: Partial<Record<ComplaintStatus, number>>;
  by_category: { name: string; count: number }[];
};

export const adminStatsQuery = () =>
  queryOptions({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw error;
      return data as unknown as AdminStats;
    },
  });

export const adminUsersQuery = () =>
  queryOptions({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return data;
    },
  });
