import { ClientHeader } from "@/components/client/ClientHeader";
import { ActionCenter } from "@/components/client/ActionCenter";
import { ClientReviewHistory } from "@/components/client/ClientReviewHistory";

export default function ClientApprovals() {
  return (
    <div className="flex flex-col gap-6">
      <ClientHeader title="Approvals" subtitle="Review deliverables, share feedback, and keep a clear decision history." />
      <ActionCenter />
      <ClientReviewHistory />
    </div>
  );
}
