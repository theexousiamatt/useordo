import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { OrdoInput } from "./OrdoInput";
import { evaluatePassword } from "./authErrors";
import { cn } from "@/lib/utils";

interface OrdoPasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Show the live strength meter + checklist. */
  showStrength?: boolean;
}

/** Password field with show/hide toggle and optional strength meter. */
export const OrdoPasswordInput = React.forwardRef<HTMLInputElement, OrdoPasswordInputProps>(
  ({ showStrength, value, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const strength = evaluatePassword(typeof value === "string" ? value : "");
    const barColors = [
      "bg-border",
      "bg-destructive",
      "bg-warning",
      "bg-accent",
      "bg-success",
    ];

    return (
      <div className="space-y-2">
        <OrdoInput
          ref={ref}
          type={visible ? "text" : "password"}
          value={value}
          rightSlot={
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={visible ? "Hide password" : "Show password"}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...props}
        />
        {showStrength && typeof value === "string" && value.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-pill transition-colors",
                    i <= strength.score ? barColors[strength.score] : "bg-border",
                  )}
                />
              ))}
            </div>
            <p className="text-[13px] text-muted-foreground">
              Password strength: <span className="font-medium text-foreground">{strength.label}</span>
            </p>
          </div>
        )}
      </div>
    );
  },
);
OrdoPasswordInput.displayName = "OrdoPasswordInput";
