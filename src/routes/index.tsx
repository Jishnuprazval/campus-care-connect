import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Camera, ClipboardCheck, MapPin, MessageSquare, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { STATUS_META, STATUS_ORDER } from "@/lib/complaints";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Campus Complaint Tracker — Report campus issues and track the fix" },
      {
        name: "description",
        content:
          "Students report broken facilities, Wi-Fi and cleanliness issues. Staff update progress until every complaint is resolved.",
      },
      { property: "og:title", content: "Campus Complaint Tracker" },
      {
        property: "og:description",
        content: "Report campus issues in a minute and follow them from submitted to resolved.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <BrandMark />
        {signedIn ? (
          <Button asChild>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex">
              <Link to="/auth" search={{ mode: "signup" }}>
                Register
              </Link>
            </Button>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
              Campus services desk
            </p>
            <h1 className="mt-6 text-5xl leading-[1.05] font-semibold text-foreground sm:text-6xl">
              Report it once.
              <br />
              <span className="text-primary">Watch it get fixed.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Flickering lights, leaking taps, dead Wi-Fi zones — log any campus issue with its
              exact location and a photo. Every update from staff shows up on your tracking
              timeline.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                {signedIn ? (
                  <Link to="/dashboard">
                    Open my dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Create a student account <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </Button>
              {!signedIn && (
                <Button asChild size="lg" variant="outline">
                  <Link to="/auth">I already have an account</Link>
                </Button>
              )}
            </div>
          </div>

          <TicketMock />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-semibold">How it works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Camera,
              title: "1. Report",
              body: "Pick a category, add the building and room, attach a photo. You get a tracking number instantly.",
            },
            {
              icon: ClipboardCheck,
              title: "2. Assigned",
              body: "An admin routes it to the right staff member, who updates the status as work progresses.",
            },
            {
              icon: MessageSquare,
              title: "3. Resolved",
              body: "Reply when staff need details. If the problem comes back, reopen it with one click.",
            },
          ].map((s) => (
            <div key={s.title} className="rounded-2xl border bg-card p-6 shadow-card">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                <s.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-semibold">Every status, at a glance</h2>
          <p className="mt-2 text-muted-foreground">
            Clear labels with icons so you always know where things stand.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATUS_ORDER.map((s) => (
              <li key={s} className="rounded-xl border bg-background p-4">
                <StatusBadge status={s} />
                <p className="mt-2 text-sm text-muted-foreground">{STATUS_META[s].description}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-4 py-10 text-sm text-muted-foreground sm:px-6">
        Campus Complaint Tracker · For students, facilities staff and administrators
      </footer>
    </div>
  );
}

function TicketMock() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="absolute -top-6 -right-4 h-full w-full rotate-3 rounded-3xl border bg-secondary" />
      <div className="relative rounded-3xl border bg-card p-6 shadow-ticket">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-semibold text-primary">CCT-26-01042</span>
          <StatusBadge status="in_progress" />
        </div>
        <p className="mt-4 font-display text-2xl font-semibold">Wi-Fi drops on library 2F</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" /> Wi-Fi/IT
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Central Library
          </span>
        </div>
        <ol className="mt-6 space-y-4 border-l pl-5 text-sm">
          <li className="relative">
            <span className="absolute top-1 -left-[25px] h-3 w-3 rounded-full bg-status-submitted" />
            <p className="font-semibold">Submitted</p>
            <p className="text-muted-foreground">Mon 09:12</p>
          </li>
          <li className="relative">
            <span className="absolute top-1 -left-[25px] h-3 w-3 rounded-full bg-status-assigned" />
            <p className="font-semibold">Assigned to IT Services</p>
            <p className="text-muted-foreground">Mon 10:30</p>
          </li>
          <li className="relative">
            <span className="absolute top-1 -left-[25px] h-3 w-3 rounded-full bg-status-in-progress" />
            <p className="font-semibold">“Replacing the access point tonight.”</p>
            <p className="text-muted-foreground">Tue 14:05</p>
          </li>
        </ol>
      </div>
    </div>
  );
}
