import { Link } from "@tanstack/react-router";
import { Landmark } from "lucide-react";

export function BrandMark({ to = "/" }: { to?: "/" | "/dashboard" }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-ring">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-card">
        <Landmark className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-semibold text-foreground">Campus Complaint</span>
        <span className="block text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Tracker
        </span>
      </span>
    </Link>
  );
}
