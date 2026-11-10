import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fieldErrors, signInSchema, signUpSchema } from "@/lib/complaints";

type AuthSearch = { redirect?: string; mode?: "signin" | "signup" };

function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/auth")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: safeRedirect(search.redirect),
    mode: search.mode === "signup" ? "signup" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Campus Complaint Tracker" },
      { name: "description", content: "Sign in or create a student account to report and track campus issues." },
      { property: "og:title", content: "Sign in — Campus Complaint Tracker" },
      { property: "og:description", content: "Sign in or create a student account to report and track campus issues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const DEMO_ACCOUNTS = [
  { label: "Student", email: "student@campus.test", password: "DemoStudent#2026" },
  { label: "Staff", email: "staff@campus.test", password: "DemoStaff#2026" },
  { label: "Admin", email: "admin@campus.test", password: "DemoAdmin#2026" },
];

function AuthPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const target = search.redirect ?? "/dashboard";
  const [tab, setTab] = useState<"signin" | "signup">(search.mode ?? "signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.history.replace(target);
    });
  }, [router, target]);

  function switchTab(value: string) {
    setTab(value as "signin" | "signup");
    setErrors({});
    setFormError(null);
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      setFormError(
        /email not confirmed/i.test(error.message)
          ? "Please confirm your email first. Check your inbox for the confirmation link."
          : /invalid login credentials/i.test(error.message)
            ? "Email or password is incorrect."
            : error.message,
      );
      return;
    }
    router.history.push(target);
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = signUpSchema.safeParse({ fullName, email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.fullName },
      },
    });
    setBusy(false);
    if (error) {
      setFormError(/already registered/i.test(error.message) ? "An account with this email already exists. Try signing in." : error.message);
      return;
    }
    if (data.session) {
      router.history.push(target);
    } else {
      setConfirmSent(parsed.data.email);
    }
  }

  async function handleGoogle() {
    setFormError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setFormError("Google sign-in didn't complete. Please try again.");
      return;
    }
    if (result.redirected) return;
    router.history.push(target);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-25 bg-hero" aria-hidden="true" />
        <div className="relative">
          <span className="font-display text-xl font-semibold">Campus Complaint Tracker</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl leading-tight font-semibold">
            Every broken light, leaky tap and dead Wi-Fi spot — tracked to the fix.
          </h1>
          <p className="mt-4 text-primary-foreground/80">
            Students report issues in a minute. Campus staff pick them up, post progress and close
            the loop.
          </p>
        </div>
        <p className="relative text-sm text-primary-foreground/70">Facilities · IT · Housekeeping</p>
      </aside>

      <section className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <BrandMark />
          <h2 className="mt-8 text-3xl font-semibold text-foreground">
            {tab === "signin" ? "Welcome back" : "Create your student account"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "signin"
              ? "Sign in to report issues or manage your assigned work."
              : "New accounts are student accounts. Staff and admin access is granted by an administrator."}
          </p>

          {confirmSent ? (
            <Alert className="mt-8">
              <MailCheck className="h-4 w-4" />
              <AlertDescription>
                We sent a confirmation link to <strong>{confirmSent}</strong>. Open it to activate your
                account, then sign in.
              </AlertDescription>
            </Alert>
          ) : (
            <Tabs value={tab} onValueChange={switchTab} className="mt-8">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Register</TabsTrigger>
              </TabsList>

              {formError && (
                <Alert variant="destructive" className="mt-4" role="alert">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} noValidate className="mt-4 space-y-4">
                  <Field id="si-email" label="Email" error={errors.email}>
                    <Input id="si-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
                  </Field>
                  <Field id="si-password" label="Password" error={errors.password}>
                    <Input id="si-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
                  </Field>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Sign in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} noValidate className="mt-4 space-y-4">
                  <Field id="su-name" label="Full name" error={errors.fullName}>
                    <Input id="su-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={!!errors.fullName} />
                  </Field>
                  <Field id="su-email" label="Email" error={errors.email}>
                    <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
                  </Field>
                  <Field id="su-password" label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
                    <Input id="su-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
                  </Field>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Create student account
                  </Button>
                </form>
              </TabsContent>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
              <GoogleButton onClick={handleGoogle} />
            </Tabs>
          )}

          <div className="mt-10 rounded-xl border border-dashed bg-muted/60 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Demo accounts — for testing only
            </p>
            <div className="mt-3 grid gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setTab("signin");
                    setEmail(a.email);
                    setPassword(a.password);
                    setErrors({});
                    setFormError(null);
                  }}
                  className="flex items-center justify-between rounded-md bg-card px-3 py-2 text-left text-sm shadow-card transition hover:ring-2 hover:ring-ring/30 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="font-semibold text-foreground">{a.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{a.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Click one to fill the sign-in form.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-center gap-[10px] rounded-md border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F] transition hover:bg-[#F8F8F8] focus-visible:outline-2 focus-visible:outline-ring"
    >
      <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
      Continue with Google
    </button>
  );
}
