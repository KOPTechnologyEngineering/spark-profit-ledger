import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfiles, Profile } from "@/hooks/useProfiles";
import { useAuth } from "@/contexts/AuthContext";

interface ApproverSelectProps {
  approver1: string;
  approver2: string;
  onApprover1Change: (v: string) => void;
  onApprover2Change: (v: string) => void;
}

export default function ApproverSelect({ approver1, approver2, onApprover1Change, onApprover2Change }: ApproverSelectProps) {
  const profiles = useProfiles();
  const { user } = useAuth();

  // Exclude self from approver selection
  const available = profiles.filter((p) => p.user_id !== user?.id);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Approver 1 *</Label>
        <Select value={approver1} onValueChange={onApprover1Change} required>
          <SelectTrigger><SelectValue placeholder="Select approver" /></SelectTrigger>
          <SelectContent>
            {available.filter((p) => p.user_id !== approver2).map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Approver 2 *</Label>
        <Select value={approver2} onValueChange={onApprover2Change} required>
          <SelectTrigger><SelectValue placeholder="Select approver" /></SelectTrigger>
          <SelectContent>
            {available.filter((p) => p.user_id !== approver1).map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
