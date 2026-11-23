import { ArrowRight, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ClientHeader } from "@/components/client/ClientHeader";
import { Button } from "@/components/ui/button";
import { DeliverableBadge } from "@/components/projects/ProjectBadges";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

const pageSize = 24;

export default function ClientDeliverables() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const query = useInfiniteQuery({
    queryKey: ["client-shared-deliverables", workspaceId],
    enabled: !!workspaceId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.from("deliverables")
        .select("id,title,status,requires_approval,version_label,projects(name)")
        .eq("workspace_id", workspaceId!)
        .neq("status", "draft")
        .order("created_at", { ascending: false }).order("id")
        .range(pageParam, pageParam + pageSize - 1);
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (lastPage, _pages, offset) => lastPage.length === pageSize ? offset + pageSize : undefined,
  });
  const items = query.data?.pages.flat() ?? [];

  return <>
    <ClientHeader title="Deliverables" subtitle="Work the studio has shared with you." />
    <section aria-label="Shared work" className="rounded-panel bg-card p-5 sm:p-6">
      {query.isPending && <p role="status" className="text-sm">Loading shared work…</p>}
      {query.isError && <p role="alert" className="text-sm">Couldn’t load all shared work. <Button variant="link" onClick={() => void query.refetch()}>Try again</Button></p>}
      {query.isSuccess && items.length === 0 && <div className="py-10 text-center">
        <Package aria-hidden="true" className="mx-auto mb-3 size-6 text-primary" />
        <h2 className="text-base font-semibold">No shared deliverables yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">Files and links will appear here when the studio shares them.</p>
      </div>}
      <ul className="divide-y divide-border">
        {items.map(item => <li key={item.id}>
          <Link to={`/client/deliverables/${item.id}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-small px-3 py-4 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring sm:px-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{item.projects?.name ?? "Project"}{item.version_label ? ` · ${item.version_label}` : ""}</p>
              <h2 className="my-1 break-words text-base font-semibold">{item.title}</h2>
              <DeliverableBadge status={item.status} requiresApproval={item.requires_approval} />
            </div>
            <ArrowRight aria-hidden="true" className="size-5 text-primary" />
          </Link>
        </li>)}
      </ul>
      {query.hasNextPage && <Button className="mt-4" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
        {query.isFetchingNextPage ? "Loading…" : "Load more deliverables"}
      </Button>}
    </section>
  </>;
}
