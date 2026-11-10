import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { StudentDashboard } from "@/components/dashboards/StudentDashboard";
import { StaffDashboard } from "@/components/dashboards/StaffDashboard";
import { AdminDashboard } from "@/components/dashboards/AdminDashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Campus Complaint Tracker" },
      { name: "description", content: "Your complaints, assigned work or campus-wide overview." },
      { property: "og:title", content: "Dashboard — Campus Complaint Tracker" },
      { property: "og:description", content: "Your complaints, assigned work or campus-wide overview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const user = useCurrentUser();
  if (user.role === "admin") return <AdminDashboard user={user} />;
  if (user.role === "staff") return <StaffDashboard user={user} />;
  return <StudentDashboard user={user} />;
}
