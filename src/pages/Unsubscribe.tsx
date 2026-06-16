import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, MailX, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State = "loading" | "valid" | "done" | "invalid" | "error";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON_KEY } },
        );
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          setState(data?.alreadyUnsubscribed ? "done" : "valid");
        } else {
          setState("invalid");
        }
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    setBusy(false);
    setState(error ? "error" : "done");
  };

  return (
    <div className="client-os flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-panel border border-border bg-card p-8 text-center shadow-panel">
        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p>Checking your request…</p>
          </div>
        )}

        {state === "valid" && (
          <div className="flex flex-col items-center gap-4">
            <MailX className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-semibold">Unsubscribe from emails?</h1>
            <p className="text-sm text-muted-foreground">
              You'll stop receiving notification emails from Ordo. You can still
              use the app and re-enable emails anytime in settings.
            </p>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="mt-2 inline-flex items-center gap-2 rounded-pill bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-[hsl(var(--primary-hover))] disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm unsubscribe
            </button>
          </div>
        )}

        {state === "done" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-[hsl(var(--badge-green-text))]" />
            <h1 className="text-xl font-semibold">You're unsubscribed</h1>
            <p className="text-sm text-muted-foreground">
              You won't receive notification emails from Ordo anymore.
            </p>
          </div>
        )}

        {(state === "invalid" || state === "error") && (
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="h-10 w-10 text-[hsl(var(--badge-orange-text))]" />
            <h1 className="text-xl font-semibold">
              {state === "invalid" ? "Link expired or invalid" : "Something went wrong"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {state === "invalid"
                ? "This unsubscribe link is no longer valid. It may have already been used."
                : "Please try again in a moment."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
