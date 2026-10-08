import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "./authErrors";

type Provider = "google" | "github";

/** Shared social sign-in handler for all auth screens. */
export function useSocialAuth() {
  const [pending, setPending] = useState<Provider | null>(null);

  const signIn = async (provider: Provider) => {
    setPending(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
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
