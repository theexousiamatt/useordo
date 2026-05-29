import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { toast } from "sonner";

export default function Clients() {
  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage the people and businesses you work with."
        actions={
          <Button onClick={() => toast("Client invites are coming soon.")}>
            <Plus className="mr-1.5 h-4 w-4" /> Invite client
          </Button>
        }
      />
      <EmptyState
        icon={Users}
        title="No clients yet"
        description="Invite clients to give them a polished portal for progress, deliverables, and approvals."
        actionLabel="Invite a client"
        onAction={() => toast("Client invites are coming soon.")}
      />
    </div>
  );
}
