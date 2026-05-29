import { useEffect, useState, useCallback } from "react";
import { UserCog, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingList } from "@/components/states/LoadingState";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/format";
import { toast } from "sonner";

interface Member {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

export default function Team() {
  const { currentWorkspace } = useWorkspace();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    setLoading(true);
    setError(false);
    const { data: rows, error: e1 } = await supabase
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", currentWorkspace.id);
    if (e1) { setError(true); setLoading(false); return; }

    const ids = (rows ?? []).map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    setMembers(
      (rows ?? []).map((r) => ({
        user_id: r.user_id,
        role: r.role,
        full_name: byId.get(r.user_id)?.full_name ?? null,
        email: byId.get(r.user_id)?.email ?? null,
      })),
    );
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="Team"
        description="The people building inside this workspace."
        actions={
          <Button onClick={() => toast("Team invites are coming soon.")}>
            <Plus className="mr-1.5 h-4 w-4" /> Invite member
          </Button>
        }
      />

      {loading ? (
        <LoadingList rows={3} />
      ) : error ? (
        <ErrorState onRetry={load} />
      ) : members.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No team members"
          description="Invite people to collaborate on projects and tasks."
          actionLabel="Invite a member"
          onAction={() => toast("Team invites are coming soon.")}
        />
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <Card key={m.user_id} className="flex items-center gap-4 p-4">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-secondary text-xs">
                  {initials(m.full_name || m.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.full_name || "Unnamed"}</div>
                <div className="truncate text-xs text-muted-foreground">{m.email || "—"}</div>
              </div>
              <Badge variant="secondary" className="capitalize">{m.role}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
