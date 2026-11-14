import { ClientHeader } from "@/components/client/ClientHeader";
import { ActionCenter } from "@/components/client/ActionCenter";
import { ClientReviewHistory } from "@/components/client/ClientReviewHistory";

export default function ClientApprovals() {
  return (
    <>
      <ClientHeader title="Approvals" subtitle="Review and sign off on deliverables." />
      <ActionCenter />
      <ClientReviewHistory />
    </>
  );
}
