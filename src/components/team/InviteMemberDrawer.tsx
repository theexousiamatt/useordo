import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Mail, Send, Users } from "lucide-react";
import { OrdoDrawer } from "@/components/ordo/OrdoDrawer";
import { OrdoField } from "@/components/ordo/OrdoField";
import { OrdoInput } from "@/components/ordo/OrdoInput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ASSIGNABLE_ROLES } from "@/lib/roles";
import type { WorkspaceRole } from "@/hooks/useWorkspace";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string;
  busy?: boolean;
  initialRole?: WorkspaceRole;
  onInvite: (emails: string[], role: WorkspaceRole) => Promise<boolean | void>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,;\n]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

const STEPS = ["Recipients", "Role", "Review"] as const;

export function InviteMemberDrawer({ open, onOpenChange, workspaceName, busy, onInvite, initialRole = "member" }: Props) {
  const [step, setStep] = useState(0);
  const [raw, setRaw] = useState("");
  const [role, setRole] = useState<WorkspaceRole>(initialRole);

  const emails = useMemo(() => parseEmails(raw), [raw]);
  const invalid = useMemo(() => emails.filter((e) => !EMAIL_RE.test(e)), [emails]);
  const validEmails = useMemo(() => emails.filter((e) => EMAIL_RE.test(e)), [emails]);

  const reset = () => {
    setStep(0);
    setRaw("");
    setRole(initialRole);
  };

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setTimeout(reset, 200);
  };

  const send = async () => {
    const ok = await onInvite(validEmails, role);
    if (ok !== false) close(false);
  };

  const canNext = step === 0 ? validEmails.length > 0 && invalid.length === 0 : true;

  return (
    <OrdoDrawer
      open={open}
      onOpenChange={close}
      title="Invite to workspace"
      description={`New teammates will join ${workspaceName}.`}
      footer={
        <div className="flex w-full items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Continue <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={send} disabled={busy}>
              <Send className="mr-1.5 h-4 w-4" />
              {busy ? "Sending…" : `Send ${validEmails.length > 1 ? `${validEmails.length} invites` : "invite"}`}
            </Button>
          )}
        </div>
      }
    >
      {/* Stepper */}
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i < step
                  ? "bg-[hsl(178,100%,8%)] text-white"
                  : i === step
                    ? "bg-[hsl(178,100%,8%)] text-white"
                    : "bg-secondary text-muted-foreground",
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px flex-1", i < step ? "bg-[hsl(178,100%,8%)]" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <OrdoField
            label="Email addresses"
            hint="Add one or many — separate with commas, spaces or new lines."
          >
            <Textarea
              autoFocus
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="ada@acme.com, grace@acme.com"
              className="min-h-28 rounded-small border-border bg-card text-sm shadow-subtle"
            />
          </OrdoField>
          {validEmails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {validEmails.map((e) => (
                <span
                  key={e}
                  className="inline-flex items-center gap-1 rounded-pill bg-secondary px-2.5 py-1 text-xs font-medium"
                >
                  <Mail className="h-3 w-3" /> {e}
                </span>
              ))}
            </div>
          )}
          {invalid.length > 0 && (
            <p className="text-xs font-medium text-destructive">
              Invalid: {invalid.join(", ")}
            </p>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choose the role for {validEmails.length > 1 ? "these teammates" : "this teammate"}.
            Ownership can only be transferred by the workspace owner.
          </p>
          {ASSIGNABLE_ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={role === r.value}
              onClick={() => setRole(r.value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-card border p-4 text-left transition-all",
                role === r.value
                  ? "border-[hsl(178,100%,8%)] bg-[hsl(178,40%,97%)] shadow-subtle"
                  : "border-border bg-card hover:border-border/80 hover:bg-secondary/50",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  role === r.value ? "border-[hsl(178,100%,8%)] bg-[hsl(178,100%,8%)]" : "border-border",
                )}
              >
                {role === r.value && <Check className="h-3 w-3 text-white" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{r.label}</div>
                <div className="text-xs text-muted-foreground">{r.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="rounded-card border border-border bg-secondary/40 p-5">
            <ReviewRow icon={Users} label="Workspace" value={workspaceName} />
            <div className="my-3 h-px bg-border" />
            <ReviewRow
              icon={Check}
              label="Assigned role"
              value={ASSIGNABLE_ROLES.find((r) => r.value === role)?.label ?? role}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recipients ({validEmails.length})
            </p>
            <div className="space-y-1.5">
              {validEmails.map((e) => (
                <div
                  key={e}
                  className="flex items-center gap-2 rounded-small bg-card px-3 py-2 text-sm shadow-subtle"
                >
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {e}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </OrdoDrawer>
  );
}

function ReviewRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-small bg-card">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
