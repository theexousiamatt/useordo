import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";
import {
  AuthLayout,
  OrdoButton,
  OrdoAlert,
} from "@/components/auth";

function formatDuration(seconds: number) {
  if (seconds <= 0) return "now";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Account locked screen. Lock reason + countdown read from query params
 * (?reason=&seconds=). Counts down and re-enables sign in when cleared.
 */
export default function AccountLocked() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reason =
    params.get("reason") ||
    "Your account has been temporarily locked due to multiple failed sign-in attempts.";
  const initial = Number(params.get("seconds") || 300);
  const [remaining, setRemaining] = useState(Number.isFinite(initial) ? initial : 300);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const unlocked = remaining <= 0;

  return (
    <AuthLayout
      showPreview={false}
      panelTitle="Account locked"
      panelSubtitle="For your security, access is paused after repeated failed attempts. You'll be able to try again shortly."
    >
      <div className="mx-auto w-full max-w-sm space-y-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-card bg-destructive/10">
          <Lock className="h-7 w-7 text-destructive" />
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Temporarily locked</h2>
          <p className="mt-2 text-muted-foreground">{reason}</p>
        </div>

        {!unlocked ? (
          <OrdoAlert variant="warning" title="Try again in">
            {formatDuration(remaining)}
          </OrdoAlert>
        ) : (
          <OrdoAlert variant="success" title="Lock cleared">
            You can now sign in again.
          </OrdoAlert>
        )}

        <div className="space-y-3">
          <OrdoButton disabled={!unlocked} onClick={() => navigate("/auth")}>
            {unlocked ? "Back to sign in" : "Locked"}
          </OrdoButton>
          <OrdoButton variant="outline" onClick={() => navigate("/auth/forgot-password")}>
            Reset password
          </OrdoButton>
        </div>
      </div>
    </AuthLayout>
  );
}
