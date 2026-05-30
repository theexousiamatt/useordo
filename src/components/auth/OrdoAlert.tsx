import * as React from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "error" | "success" | "warning" | "info";

interface OrdoAlertProps {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

const config: Record<AlertVariant, { icon: typeof AlertCircle; classes: string }> = {
  error: { icon: AlertCircle, classes: "border-destructive/30 bg-destructive/5 text-destructive" },
  success: { icon: CheckCircle2, classes: "border-success/30 bg-success/5 text-success" },
  warning: { icon: AlertTriangle, classes: "border-warning/30 bg-warning/5 text-warning" },
  info: { icon: Info, classes: "border-accent/30 bg-accent/5 text-accent" },
};

/** Premium inline alert used for auth status, errors and confirmations. */
export function OrdoAlert({ variant = "info", title, children, className }: OrdoAlertProps) {
  const { icon: Icon, classes } = config[variant];
  return (
    <div className={cn("flex items-start gap-3 rounded-small border px-4 py-3", classes, className)}>
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <div className="space-y-0.5 text-[13.5px] leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <p className="opacity-90">{children}</p>}
      </div>
    </div>
  );
}
