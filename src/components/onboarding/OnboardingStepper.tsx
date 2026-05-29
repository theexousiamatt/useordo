import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { ONBOARDING_STEPS } from "./onboardingSteps";

interface OnboardingStepperProps {
  current: number;
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/**
 * OnboardingStepper — vertical on desktop sidebar, horizontal progress on mobile.
 * Reusable for any future guided/adoption flow.
 */
export function OnboardingStepper({ current, orientation = "vertical", className }: OnboardingStepperProps) {
  if (orientation === "horizontal") {
    return (
      <ol className={cn("flex items-center gap-1.5", className)} aria-label="Onboarding progress">
        {ONBOARDING_STEPS.map((s) => {
          const done = s.id < current;
          const active = s.id === current;
          return (
            <li
              key={s.id}
              aria-current={active ? "step" : undefined}
              className={cn(
                "h-1.5 flex-1 rounded-pill transition-colors",
                done || active ? "bg-foreground" : "bg-border",
              )}
            />
          );
        })}
      </ol>
    );
  }

  return (
    <ol className={cn("flex flex-col gap-1", className)} aria-label="Onboarding progress">
      {ONBOARDING_STEPS.map((s) => {
        const done = s.id < current;
        const active = s.id === current;
        return (
          <li key={s.id} aria-current={active ? "step" : undefined}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-small px-3 py-2.5 transition-all",
                active && "bg-card text-foreground shadow-subtle",
                !active && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  done || active ? "bg-foreground text-background" : "bg-border text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : s.id}
              </span>
              <span className={cn("text-sm", active ? "font-medium" : "font-normal")}>{s.label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
