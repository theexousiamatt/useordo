import { safeReturnPath } from "@/lib/authReturn";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "./authErrors";

type Provider = "google" | "github";

/** Shared social sign-in handler for all auth screens. */
export function useSocialAuth(returnTo = "/") {
  const [pending, setPending] = useState<Provider | null>(null);

  const signIn = async (provider: Provider) => {
    setPending(provider);
    try {
      if (provider === "google") {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        if (!response.ok) throw new Error("Could not check sign-in availability.");
        const settings = await response.json();
        if (!settings.external?.google) {
          toast.info("Google sign-in is coming soon. Use your email to continue.");
          setPending(null);
          return;
        }
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: new URL(safeReturnPath(returnTo), window.location.origin).toString() },
      });
      if (error) {
        toast.error(friendlyAuthError(error));
        setPending(null);
      }
    } catch (err) {
      toast.error(friendlyAuthError(err));
      setPending(null);
    }
  };

  return { signIn, pending };
}
