import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { categoriesQuery } from "@/lib/queries";
import { fieldErrors, friendlyError , type FormErrors } from "@/lib/complaints";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, RestrictedNotice } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({
    meta: [
      { title: "Categories — Campus Complaint Tracker" },
      { name: "description", content: "Manage the complaint categories students can choose from." },
      { property: "og:title", content: "Categories — Campus Complaint Tracker" },
      { property: "og:description", content: "Manage the complaint categories students can choose from." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CategoriesPage,
});

const categorySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name must be 60 characters or fewer"),
  description: z.string().trim().max(200, "Description must be 200 characters or fewer"),
});

type Cat = { id: string; name: string; description: string | null; is_active: boolean };

function CategoriesPage() {
  const me = useCurrentUser();
  if (me.role !== "admin") return <RestrictedNotice />;
  return <CategoriesAdmin />;
}

function CategoriesAdmin() {
  const q = useQuery(categoriesQuery());
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [editing, setEditing] = useState<Cat | null>(null);
  const [deleting, setDeleting] = useState<Cat | null>(null);

  const create = useMutation({
    mutationFn: async (v: { name: string; description: string }) => {
      const { error } = await supabase.from("categories").insert({ name: v.name, description: v.description || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category added");
      setName("");
      setDescription("");
      invalidate();
    },
    onError: (e) => setErrors({ name: friendlyError(e) }),
  });

  const toggle = useMutation({
    mutationFn: async (c: Cat) => {
      const { error } = await supabase.from("categories").update({ is_active: !c.is_active, updated_at: new Date().toISOString() }).eq("id", c.id);
      if (error) throw error;
      return c;
    },
    onSuccess: (c) => {
      toast.success(c.is_active ? `${c.name} hidden from new complaints` : `${c.name} is available again`);
      invalidate();
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async (c: Cat) => {
      const { error } = await supabase.from("categories").delete().eq("id", c.id);
      if (error) throw error;
      return c;
    },
    onSuccess: (c) => {
      toast.success(`${c.name} deleted`);
      invalidate();
    },
    onError: (e) => toast.error(/foreign key|still in use/i.test(String((e as Error).message)) ? "This category is used by existing complaints. Turn it off instead." : friendlyError(e)),
    onSettled: () => setDeleting(null),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = categorySchema.safeParse({ name, description });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    create.mutate(parsed.data);
  }

  return (
    <>
      <PageHeader eyebrow="Administration" title="Categories" description="Turn a category off to hide it from new complaints without affecting existing ones." />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {q.isLoading ? (
            <ListSkeleton rows={5} />
          ) : q.isError ? (
            <ErrorState message={friendlyError(q.error)} onRetry={() => q.refetch()} />
          ) : (q.data ?? []).length === 0 ? (
            <EmptyState icon={Tags} title="No categories yet" description="Add the first one using the form." />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-card">
              {(q.data ?? []).map((c) => (
                <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {c.name}
                      {!c.is_active && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Off</span>}
                    </p>
                    {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 pr-2">
                      <Switch id={`active-${c.id}`} checked={c.is_active} onCheckedChange={() => toggle.mutate(c)} disabled={toggle.isPending} />
                      <Label htmlFor={`active-${c.id}`} className="text-sm text-muted-foreground">Active</Label>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label={`Rename ${c.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(c)} aria-label={`Delete ${c.name}`} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={submit} noValidate className="h-fit space-y-4 rounded-xl border bg-card p-5 shadow-card">
          <h2 className="text-lg font-semibold">Add a category</h2>
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name *</Label>
            <Input id="c-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-sm text-destructive" role="alert">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Description</Label>
            <Input id="c-desc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
            {errors.description && <p className="text-sm text-destructive" role="alert">{errors.description}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            Add category
          </Button>
        </form>
      </div>

      {editing && <EditCategoryDialog cat={editing} onClose={() => setEditing(null)} onSaved={invalidate} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Categories used by existing complaints can't be deleted — turn them off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleting && remove.mutate(deleting)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditCategoryDialog({ cat, onClose, onSaved }: { cat: Cat; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(cat.name);
  const [description, setDescription] = useState(cat.description ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const m = useMutation({
    mutationFn: async (v: { name: string; description: string }) => {
      const { error } = await supabase.from("categories").update({ name: v.name, description: v.description || null, updated_at: new Date().toISOString() }).eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category saved");
      onSaved();
      onClose();
    },
    onError: (e) => setErrors({ name: friendlyError(e) }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit category</DialogTitle></DialogHeader>
        <form
          id="cat-edit"
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = categorySchema.safeParse({ name, description });
            if (!parsed.success) return setErrors(fieldErrors(parsed.error));
            m.mutate(parsed.data);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ce-name">Name</Label>
            <Input id="ce-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            {errors.name && <p className="text-sm text-destructive" role="alert">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ce-desc">Description</Label>
            <Input id="ce-desc" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
            {errors.description && <p className="text-sm text-destructive" role="alert">{errors.description}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="cat-edit" disabled={m.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
