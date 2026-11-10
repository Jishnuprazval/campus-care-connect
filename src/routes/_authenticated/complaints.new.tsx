import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { categoriesQuery } from "@/lib/queries";
import {
  complaintSchema,
  fieldErrors,
  friendlyError,
  validateImage,
  type FormErrors,
} from "@/lib/complaints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/common";

export const Route = createFileRoute("/_authenticated/complaints/new")({
  head: () => ({
    meta: [
      { title: "Report an issue — Campus Complaint Tracker" },
      {
        name: "description",
        content: "Submit a new campus complaint with location details and an optional photo.",
      },
      { property: "og:title", content: "Report an issue — Campus Complaint Tracker" },
      {
        property: "og:description",
        content: "Submit a new campus complaint with location details and an optional photo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewComplaintPage,
});

const EMPTY = { title: "", description: "", categoryId: "", location: "", roomNumber: "" };

function NewComplaintPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const cats = useQuery(categoriesQuery());
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; tracking: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (user.role !== "student") {
    return (
      <EmptyState
        title="Only students submit complaints"
        description="Staff and admin accounts manage complaints from the dashboard."
        action={
          <Button asChild variant="outline">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        }
      />
    );
  }

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function pickFile(f: File | undefined) {
    if (!f) return;
    const err = validateImage(f);
    if (err) {
      setErrors((e) => ({ ...e, image: err }));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setErrors(({ image: _image, ...rest }) => rest);
    setFile(f);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = complaintSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    let imagePath: string | null = null;
    try {
      if (file) {
        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        imagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage
          .from("complaint-images")
          .upload(imagePath, file, { contentType: file.type, upsert: false });
        if (up.error) throw up.error;
      }
      const { data, error } = await supabase
        .from("complaints")
        .insert({
          title: parsed.data.title,
          description: parsed.data.description,
          category_id: parsed.data.categoryId,
          location: parsed.data.location,
          room_number: parsed.data.roomNumber || null,
          image_path: imagePath,
          student_id: user.id,
          tracking_number: "pending",
        })
        .select("id, tracking_number")
        .single();
      if (error) throw error;
      setCreated({ id: data.id, tracking: data.tracking_number });
      qc.invalidateQueries({ queryKey: ["complaints"] });
      toast.success("Complaint submitted");
    } catch (err) {
      if (imagePath) await supabase.storage.from("complaint-images").remove([imagePath]);
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-ticket">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-status-resolved/15 text-status-resolved">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-3xl font-semibold">Complaint submitted</h1>
          <p className="mt-2 text-muted-foreground">
            Keep this tracking number to follow its progress.
          </p>
          <p
            className="mt-6 rounded-xl border-2 border-dashed border-primary/40 bg-secondary px-4 py-4 font-mono text-2xl font-semibold tracking-wider text-primary"
            aria-label="Tracking number"
          >
            {created.tracking}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
            <Button asChild>
              <Link to="/complaints/$id" params={{ id: created.id }}>
                View complaint
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreated(null);
                setForm(EMPTY);
                setFile(null);
              }}
            >
              Submit another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const activeCats = (cats.data ?? []).filter((c) => c.is_active);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to dashboard
      </Link>
      <PageHeader
        eyebrow="New complaint"
        title="Report an issue"
        description="Tell us what's wrong and where. Fields marked * are required."
      />

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6 rounded-2xl border bg-card p-5 shadow-card sm:p-8"
      >
        {formError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Field
          id="title"
          label="Title *"
          error={errors.title}
          hint="A short summary, e.g. “Projector not working in SR-3”"
        >
          <Input
            id="title"
            value={form.title}
            maxLength={120}
            onChange={(e) => set("title")(e.target.value)}
            aria-invalid={!!errors.title}
          />
        </Field>

        <Field
          id="description"
          label="Description *"
          error={errors.description}
          hint={`${form.description.length}/4000`}
        >
          <Textarea
            id="description"
            rows={6}
            value={form.description}
            maxLength={4000}
            onChange={(e) => set("description")(e.target.value)}
            aria-invalid={!!errors.description}
            placeholder="What happened, since when, and how it affects you."
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id="category" label="Category *" error={errors.categoryId}>
            <Select
              value={form.categoryId}
              onValueChange={set("categoryId")}
              disabled={cats.isLoading}
            >
              <SelectTrigger id="category" aria-invalid={!!errors.categoryId} className="w-full">
                <SelectValue placeholder={cats.isLoading ? "Loading…" : "Choose a category"} />
              </SelectTrigger>
              <SelectContent>
                {activeCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="location" label="Building / location *" error={errors.location}>
            <Input
              id="location"
              value={form.location}
              maxLength={120}
              onChange={(e) => set("location")(e.target.value)}
              aria-invalid={!!errors.location}
              placeholder="e.g. Central Library"
            />
          </Field>
          <Field id="room" label="Room number" error={errors.roomNumber} hint="Optional">
            <Input
              id="room"
              value={form.roomNumber}
              maxLength={30}
              onChange={(e) => set("roomNumber")(e.target.value)}
              aria-invalid={!!errors.roomNumber}
              placeholder="e.g. A-104"
            />
          </Field>
        </div>

        <div className="space-y-2">
          <Label htmlFor="photo">Photo</Label>
          {preview ? (
            <div className="flex items-start gap-4 rounded-xl border p-3">
              <img
                src={preview}
                alt="Selected photo preview"
                className="h-24 w-32 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{file?.name}</p>
                <p className="text-muted-foreground">
                  {((file?.size ?? 0) / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 -ml-2"
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <label
              htmlFor="photo"
              className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition hover:border-primary/50 hover:bg-secondary/50 focus-within:outline-2 focus-within:outline-ring"
            >
              <ImagePlus className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <span className="mt-2 text-sm font-medium">Add a photo (optional)</span>
              <span className="text-xs text-muted-foreground">JPG, PNG or WebP · up to 5 MB</span>
            </label>
          )}
          <input
            ref={fileRef}
            id="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {errors.image && (
            <p className="text-sm text-destructive" role="alert">
              {errors.image}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
          <Button asChild variant="ghost">
            <Link to="/dashboard">Cancel</Link>
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Submit complaint
          </Button>
        </div>
      </form>
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
  error?: string | undefined;
  hint?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
