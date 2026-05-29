import { ClientHeader } from "@/components/client/ClientHeader";
import { EmptyState } from "@/components/states/EmptyState";
import { LucideIcon } from "lucide-react";

interface ClientComingSoonProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  description: string;
}

export default function ClientComingSoon({ title, subtitle, icon, description }: ClientComingSoonProps) {
  return (
    <>
      <ClientHeader title={title} subtitle={subtitle} />
      <EmptyState icon={icon} title={`${title} is on the way`} description={description} />
    </>
  );
}
