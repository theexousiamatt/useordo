import { useState } from "react";
import { Plus, X, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ordo";
import { EmptyState } from "@/components/states/EmptyState";
import { toast } from "sonner";

interface InviteUsersStepProps {
  title: string;
  description: string;
  placeholder: string;
  emails: string[];
  onChange: (emails: string[]) => void;
  /** Empty-state copy when no invites have been added yet. */
  emptyLabel: string;
}

/**
 * InviteUsersStep — reusable email invite collector for team & client steps.
 */
export function InviteUsersStep({
  title,
  description,
  placeholder,
  emails,
  onChange,
  emptyLabel,
}: InviteUsersStepProps) {
  const [value, setValue] = useState("");

  const add = () => {
    const email = value.trim().toLowerCase();
    if (!email) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (emails.includes(email)) {
      toast.info("That email is already on the list");
      return;
    }
    onChange([...emails, email]);
    setValue("");
  };

  const remove = (email: string) => onChange(emails.filter((e) => e !== email));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <SectionHeader title={title} description={description} />

      <div className="flex gap-2">
        <Input
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-11 rounded-small bg-background"
        />
        <Button type="button" variant="secondary" className="h-11 shrink-0 rounded-small" onClick={add}>
          <Plus className="h-4 w-4" />
          <span className="sr-only">Add</span>
        </Button>
      </div>

      {emails.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={emptyLabel}
          description="Add as many as you like — or skip and invite people later from Settings."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {emails.map((email) => (
            <li
              key={email}
              className="flex items-center justify-between rounded-small bg-background px-4 py-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase text-muted-foreground">
                  {email[0]}
                </span>
                <span className="truncate">{email}</span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${email}`}
                onClick={() => remove(email)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
