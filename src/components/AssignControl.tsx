import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/complaints";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StaffOption = { id: string; full_name: string; open_assigned: number };

export function AssignControl({
  complaintId,
  currentAssignee,
  staff,
  className,
}: {
  complaintId: string;
  currentAssignee: string | null;
  staff: StaffOption[];
  className?: string;
}) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase.rpc("assign_complaint", {
        _complaint_id: complaintId,
        _staff_id: staffId,
      });
      if (error) throw error;
      return staffId;
    },
    onSuccess: (staffId) => {
      const name = staff.find((s) => s.id === staffId)?.full_name ?? "staff";
      toast.success(currentAssignee ? `Reassigned to ${name}` : `Assigned to ${name}`);
      qc.invalidateQueries({ queryKey: ["complaints"] });
      qc.invalidateQueries({ queryKey: ["complaint", complaintId] });
      qc.invalidateQueries({ queryKey: ["complaint-updates", complaintId] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  return (
    <div className={className}>
      <Select
        value={currentAssignee ?? ""}
        onValueChange={(v) => v !== currentAssignee && m.mutate(v)}
        disabled={m.isPending || staff.length === 0}
      >
        <SelectTrigger
          className="w-full min-w-[190px]"
          aria-label={currentAssignee ? "Reassign complaint" : "Assign complaint"}
        >
          <SelectValue
            placeholder={
              staff.length === 0
                ? "No staff accounts"
                : m.isPending
                  ? "Assigning…"
                  : "Assign to staff…"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {staff.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.full_name} · {s.open_assigned} open
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
