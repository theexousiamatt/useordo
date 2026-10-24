import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader, OrdoField } from "@/components/ordo";

export interface ProjectDraft {
  name: string;
  client: string;
  description: string;
}

interface ProjectCreationStepProps {
  draft: ProjectDraft;
  onChange: (draft: ProjectDraft) => void;
  /** Optional client emails collected earlier to offer as a client. */
  clientOptions: string[];
}

const NO_CLIENT = "__none__";

/**
 * ProjectCreationStep — optional first-project form, premium inputs only.
 */
export function ProjectCreationStep({ draft, onChange, clientOptions }: ProjectCreationStepProps) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <SectionHeader
        title="Create your first project"
        description="Spin up a project to see Ordo in action. This is optional — you can skip it."
      />

      <div className="flex flex-col gap-5">
        <OrdoField label="Project name" htmlFor="project-name">
          <Input
            id="project-name"
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="Website redesign"
            className="h-11 rounded-small bg-background"
          />
        </OrdoField>

        {clientOptions.length > 0 && <OrdoField label="Client" htmlFor="project-client" hint="Assign clients after they accept their invitation.">
          <Select
            value={draft.client || NO_CLIENT}
            onValueChange={(v) => onChange({ ...draft, client: v === NO_CLIENT ? "" : v })}
          >
            <SelectTrigger id="project-client" className="h-11 rounded-small bg-background">
              <SelectValue placeholder="No client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CLIENT}>No client</SelectItem>
              {clientOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </OrdoField>}

        <OrdoField label="Description" htmlFor="project-description">
          <Textarea
            id="project-description"
            value={draft.description}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
            placeholder="What is this project about?"
            rows={4}
            className="rounded-small bg-background"
          />
        </OrdoField>
      </div>
    </div>
  );
}
