import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout, OrdoAlert, OrdoButton } from ".";
import { useAuth } from "@/hooks/useAuth";
import { authReturnPath } from "@/lib/authReturn";

type Pending = { token: string; workspace_name: string; project_name: string | null; role: string };
/** Only a successful, empty invitation lookup can lead a new user to agency setup. */
export function InvitationInbox({ allowSetup = true }: { allowSetup?: boolean }) {
  const { user, loading } = useAuth();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["my-pending-invitations", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as { rpc: (name: string) => Promise<{ data: Pending[] | null; error: unknown }> }).rpc("my_pending_invitations");
      if (error || !Array.isArray(data)) throw new Error("We couldn't check your invitations.");
      return data;
    },
  });
  const remembered = authReturnPath(new URLSearchParams());
  if (!loading && !user) return <Navigate to="/auth?redirect=%2Fauth%2Finvitations" replace />;
  if (remembered.startsWith("/auth/invite?")) return <Navigate to={remembered} replace />;
  if (allowSetup && !isPending && !error && data?.length === 0) return <Navigate to="/onboarding?create=1" replace />;
  return <AuthLayout showPreview={false} panelTitle="Your invitations" panelSubtitle="Join an existing project or workspace. There’s no agency setup to complete.">
    <div className="space-y-5"><h2 className="text-2xl font-semibold">Work shared with you</h2>
      {(loading || isPending) ? <p role="status">Checking your invitations…</p> : error ? <><OrdoAlert variant="error">We couldn't check your invitations. Try again before setting up a workspace.</OrdoAlert><OrdoButton onClick={() => refetch()}>Try again</OrdoButton></> : !data?.length ? <p className="text-sm text-muted-foreground">No pending invitations. <Link to="/" className="font-semibold underline">Return to your workspace</Link></p> : data?.map(invite => <Link key={invite.token} className="block rounded-small border border-border p-4 hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" to={`/auth/invite?token=${encodeURIComponent(invite.token)}`}><span className="block font-semibold">{invite.project_name ?? invite.workspace_name}</span><span className="text-sm text-muted-foreground">{invite.workspace_name} · View invitation</span></Link>)}
      {allowSetup && !isPending && !error && !!data?.length && <Link to="/onboarding?create=1" className="block text-sm text-muted-foreground underline underline-offset-4">Creating your own agency? Set up a workspace instead</Link>}
    </div>
  </AuthLayout>;
}
