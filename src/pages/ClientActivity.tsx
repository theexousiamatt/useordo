import { ClientHeader } from "@/components/client/ClientHeader";
import { ActivityFeed } from "@/components/client/ActivityFeed";

export default function ClientActivity() {
  return (
    <>
      <ClientHeader title="Activity" subtitle="A trail of everything happening across your projects." />
      <ActivityFeed limit={30} />
    </>
  );
}
