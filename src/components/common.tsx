import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">{eyebrow}</p>
        )}
        <h1 className="mt-1 text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  onClick,
  active,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string | undefined;
  tone?: "default" | "primary" | "accent" | "warning";
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClass = {
    default: "bg-secondary text-secondary-foreground",
    primary: "bg-primary text-primary-foreground",
    accent: "bg-accent text-accent-foreground",
    warning: "bg-status-needs-info/15 text-status-needs-info",
  }[tone];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border bg-card p-5 text-left shadow-card transition",
        onClick && "hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring",
        active && "border-primary ring-2 ring-primary/20",
      )}
    >
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl font-semibold text-foreground tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className={cn("grid h-10 w-10 place-items-center rounded-lg", toneClass)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </Comp>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/60 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      <p className="mt-3 font-semibold text-foreground">We couldn't load this</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-[88px] animate-pulse rounded-xl border bg-card" />
      ))}
    </div>
  );
}

export function RestrictedNotice({ title = "Admins only" }: { title?: string }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      description="Your account doesn't have access to this page."
    />
  );
}
