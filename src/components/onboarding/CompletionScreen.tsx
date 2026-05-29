import { CheckCircle2 } from "lucide-react";

interface CompletionScreenProps {
  workspaceName: string;
}

/**
 * CompletionScreen — premium success state shown before entering the workspace.
 */
export function CompletionScreen({ workspaceName }: CompletionScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-[hsl(var(--success)/0.2)]" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--success)/0.12)]">
          <CheckCircle2 className="h-10 w-10 text-[hsl(var(--success))]" />
        </span>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">You're all set</h2>
        <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{workspaceName}</span> is ready. Welcome to your
          new operating system for execution — let's get to work.
        </p>
      </div>
    </div>
  );
}
