import { supabase } from "@/integrations/supabase/client";

/**
 * Ordo app-email sender. Fire-and-forget wrapper around the
 * `send-transactional-email` edge function. Email failures must never block the
 * primary user action, so errors are swallowed (and logged) rather than thrown.
 */
export type OrdoEmailTemplate =
  | "workspace-invitation"
  | "task-assigned"
  | "deliverable-approved"
  | "deliverable-rejected"
  | "notification";

export async function sendAppEmail(params: {
  template: OrdoEmailTemplate;
  to: string;
  idempotencyKey: string;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: params.template,
        recipientEmail: params.to,
        idempotencyKey: params.idempotencyKey,
        templateData: params.data ?? {},
      },
    });
    if (error) {
      console.warn("[email] send failed", params.template, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[email] send threw", params.template, err);
    return false;
  }
}
