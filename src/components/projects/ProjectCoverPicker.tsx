import { useId } from "react";
import { Check } from "lucide-react";
import { projectCover, projectCovers, projectCoverUrl, type ProjectCoverId } from "@/lib/projectCovers";

interface Props {
  projectId: string;
  value: ProjectCoverId | null;
  onChange: (value: ProjectCoverId | null) => void;
  disabled: boolean;
}

export function ProjectCoverPicker({ projectId, value, onChange, disabled }: Props) {
  const name = useId();
  const options = [
    { value: null, label: "Automatic", image: projectCover(projectId) },
    ...projectCovers.map(cover => ({ value: cover.id, label: cover.name, image: cover })),
  ];
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold">Project cover</legend>
      <div className="grid grid-cols-3 gap-2">
        {options.map(option => (
          <label key={option.value ?? "automatic"} className="relative block min-w-0 cursor-pointer">
            <input type="radio" name={name} className="peer sr-only" checked={value === option.value}
              onChange={() => onChange(option.value)} />
            <span className="block rounded-xl border p-1 text-center peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              <img className="aspect-[4/3] w-full rounded-lg object-cover" src={projectCoverUrl(option.image)} alt="" loading="lazy" />
              {value === option.value && <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="size-3.5" aria-hidden="true" /></span>}
              <span className="block px-0.5 py-1 text-xs font-medium leading-tight">{option.label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
