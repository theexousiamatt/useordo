import { useMemo, useState } from "react";
import {
  UserCog,
  Plus,
  Download,
  ShieldCheck,
  Mail,
  Clock,
  Copy,
  RefreshCw,
  Ban,
  Trash2,
  CircleUserRound,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/ordo/MetricCard";
import { OrdoCard } from "@/components/ordo/OrdoCard";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingList } from "@/components/states/LoadingState";
import { OrdoContextMenu, OrdoOverflowMenu, type OrdoMenuConfig } from "@/components/ordo/OrdoMenu";
import { InviteMemberDrawer } from "@/components/team/InviteMemberDrawer";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useTeam, inviteLink, type TeamMember, type Invitation } from "@/hooks/useTeam";
import { permissionsFor, roleBadge, roleLabel, ASSIGNABLE_ROLES } from "@/lib/roles";
import { initials, dateShort, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Team() {
  const { currentWorkspace, role } = useWorkspace();
  const team = useTeam();
  const perms = permissionsFor(role);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => void;
    destructive?: boolean;
  } | null>(null);

  const activeMembers = useMemo(
    () => team.members.filter((m) => m.status === "active").length,
    [team.members],
  );

  const exportTeam = () => {
    const header = "Name,Email,Role,Status,Joined\n";
    const rows = team.members
      .map((m) =>
        [m.full_name ?? "", m.email ?? "", m.role, m.status, m.joined_at ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentWorkspace?.slug ?? "team"}-members.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Team exported");
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(inviteLink(token));
    toast.success("Invite link copied");
  };

  const memberMenu = (m: TeamMember): OrdoMenuConfig => {
    const roleSubmenu = ASSIGNABLE_ROLES.map((r) => ({
      id: `role-${r.value}`,
      label: r.label,
      onSelect: () => team.changeRole(m.id, r.value),
      disabled: m.role === r.value,
    }));
    return [
      {
        id: "view",
        items: [
          {
            id: "profile",
            label: "View profile",
            icon: CircleUserRound,
            onSelect: () => toast(m.full_name || m.email || "Member"),
          },
        ],
      },
      ...(perms.assignRoles && !m.is_owner
        ? [
            {
              id: "role",
              label: "Manage",
              items: [{ id: "change-role", label: "Change role", icon: ShieldCheck, submenu: roleSubmenu }],
            },
          ]
        : []),
      ...(perms.manageMembers && !m.is_owner
        ? [
            {
              id: "danger",
              items: [
                {
                  id: "deactivate",
                  label: m.status === "active" ? "Deactivate" : "Reactivate",
                  icon: Ban,
                  onSelect: () =>
                    m.status === "active"
                      ? setConfirm({
                          title: "Deactivate member?",
                          description: `${m.full_name || m.email} will lose access until reactivated.`,
                          action: () => team.setMemberStatus(m.id, "deactivated"),
                        })
                      : team.setMemberStatus(m.id, "active"),
                },
                {
                  id: "remove",
                  label: "Remove from workspace",
                  icon: Trash2,
                  destructive: true,
                  onSelect: () =>
                    setConfirm({
                      title: "Remove member?",
                      description: `${m.full_name || m.email} will be removed from this workspace. This cannot be undone.`,
                      action: () => team.removeMember(m.id),
                      destructive: true,
                    }),
                },
              ],
            },
          ]
        : []),
    ];
  };

  if (!currentWorkspace) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Manage members, roles and invitations for this workspace."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportTeam}>
              <Download className="mr-1.5 h-4 w-4" /> Export
            </Button>
            {perms.inviteMembers && (
              <Button onClick={() => setInviteOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Invite member
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Team members" value={String(activeMembers)} icon={UserCog} />
        <MetricCard label="Pending invitations" value={String(team.invitations.length)} icon={Mail} />
        <MetricCard label="Your role" value={roleLabel(role)} icon={ShieldCheck} />
      </div>

      {team.loading ? (
        <LoadingList rows={4} />
      ) : team.error ? (
        <ErrorState onRetry={team.reload} />
      ) : (
        <>
          {/* Directory */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight">Directory</h2>
            {team.members.length === 0 ? (
              <EmptyState
                icon={UserCog}
                title="No team members"
                description="Invite people to collaborate on projects and tasks."
                actionLabel={perms.inviteMembers ? "Invite a member" : undefined}
                onAction={perms.inviteMembers ? () => setInviteOpen(true) : undefined}
              />
            ) : (
              <OrdoCard flush className="divide-y divide-border/60 overflow-hidden">
                {team.members.map((m) => (
                  <OrdoContextMenu key={m.id} config={memberMenu(m)}>
                    <div
                      className={cn(
                        "flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50",
                        m.status !== "active" && "opacity-60",
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                        <AvatarFallback className="bg-secondary text-xs">
                          {initials(m.full_name || m.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{m.full_name || "Unnamed"}</span>
                          {m.status !== "active" && (
                            <span className="rounded-pill bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Deactivated
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{m.email || "—"}</div>
                      </div>
                      <div className="hidden w-32 text-xs text-muted-foreground sm:block">
                        {m.last_active_at ? `Active ${timeAgo(m.last_active_at)}` : "—"}
                      </div>
                      <div className="hidden w-28 text-xs text-muted-foreground md:block">
                        {dateShort(m.joined_at)}
                      </div>
                      <span
                        className={cn(
                          "rounded-pill px-2.5 py-1 text-xs font-medium capitalize",
                          roleBadge(m.role),
                        )}
                      >
                        {roleLabel(m.role)}
                      </span>
                      <OrdoOverflowMenu
                        config={memberMenu(m)}
                        trigger={
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
                  </OrdoContextMenu>
                ))}
              </OrdoCard>
            )}
          </section>

          {/* Pending invitations */}
          {team.invitations.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold tracking-tight">
                Pending invitations
                <span className="ml-2 text-muted-foreground">({team.invitations.length})</span>
              </h2>
              <OrdoCard flush className="divide-y divide-border/60 overflow-hidden">
                {team.invitations.map((inv) => (
                  <InvitationRow
                    key={inv.id}
                    inv={inv}
                    canManage={perms.manageMembers}
                    onCopy={() => copyLink(inv.token)}
                    onResend={() => team.resendInvite(inv.id)}
                    onRevoke={() =>
                      setConfirm({
                        title: "Revoke invitation?",
                        description: `The invite for ${inv.email} will stop working immediately.`,
                        action: () => team.revokeInvite(inv.id),
                        destructive: true,
                      })
                    }
                  />
                ))}
              </OrdoCard>
            </section>
          )}
        </>
      )}

      <InviteMemberDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceName={currentWorkspace.name}
        busy={team.busy}
        onInvite={team.inviteMembers}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="client-os">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                confirm?.action();
                setConfirm(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InvitationRow({
  inv,
  canManage,
  onCopy,
  onResend,
  onRevoke,
}: {
  inv: Invitation;
  canManage: boolean;
  onCopy: () => void;
  onResend: () => void;
  onRevoke: () => void;
}) {
  const expired = new Date(inv.expires_at).getTime() < Date.now();
  return (
    <div className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
        <Mail className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{inv.email}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {expired ? "Expired" : `Expires ${timeAgo(inv.expires_at)}`} · Sent {timeAgo(inv.created_at)}
        </div>
      </div>
      <span className={cn("rounded-pill px-2.5 py-1 text-xs font-medium capitalize", roleBadge(inv.role))}>
        {roleLabel(inv.role)}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy} title="Copy invite link">
          <Copy className="h-4 w-4" />
        </Button>
        {canManage && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onResend} title="Resend">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onRevoke}
              title="Revoke"
            >
              <Ban className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
