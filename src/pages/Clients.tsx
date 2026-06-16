import { useMemo, useState } from "react";
import { Users, Plus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { LoadingList } from "@/components/states/LoadingState";
import { InviteMemberDrawer } from "@/components/team/InviteMemberDrawer";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTeam } from "@/hooks/useTeam";
import { roleBadge } from "@/lib/roles";
import { timeAgo } from "@/lib/format";

function initials(name: string | null, email: string | null) {
  const base = name ?? email ?? "?";
  return base
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function Clients() {
  const { currentWorkspace, role } = useWorkspace();
  const { members, invitations, loading, busy, inviteMembers } = useTeam();
  const [inviteOpen, setInviteOpen] = useState(false);

  const canInvite = role === "owner" || role === "manager";

  const clients = useMemo(
    () => members.filter((m) => m.role === "client"),
    [members],
  );
  const pendingClients = useMemo(
    () => invitations.filter((i) => i.role === "client"),
    [invitations],
  );

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage the people and businesses you work with."
        actions={
          canInvite ? (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Invite client
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <LoadingList rows={4} />
      ) : clients.length === 0 && pendingClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Invite clients to give them a polished portal for progress, deliverables, and approvals."
          actionLabel={canInvite ? "Invite a client" : undefined}
          onAction={canInvite ? () => setInviteOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-6">
          {clients.length > 0 && (
            <Card className="divide-y divide-border">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-4">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{initials(c.full_name, c.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.full_name ?? c.email ?? "Client"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  </div>
                  <Badge className={roleBadge("client")}>Client</Badge>
                </div>
              ))}
            </Card>
          )}

          {pendingClients.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                Pending invitations
              </h2>
              <Card className="divide-y divide-border">
                {pendingClients.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited {timeAgo(i.created_at)}
                      </p>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </div>
      )}

      <InviteMemberDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceName={currentWorkspace?.name ?? "your workspace"}
        busy={busy}
        onInvite={inviteMembers}
      />
    </div>
  );
}
