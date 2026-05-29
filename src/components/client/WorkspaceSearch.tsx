import { Search } from "lucide-react";

interface WorkspaceSearchProps {
  placeholder?: string;
}

export function WorkspaceSearch({ placeholder = "Search projects, files…" }: WorkspaceSearchProps) {
  return (
    <div className="flex w-full items-center rounded-pill bg-card px-5 py-2.5 shadow-panel sm:w-80">
      <Search className="h-4 w-4 shrink-0 text-[hsl(var(--text-tertiary))]" aria-hidden="true" />
      <input
        type="search"
        aria-label="Search workspace"
        placeholder={placeholder}
        className="ml-2.5 w-full border-none bg-transparent text-sm text-foreground outline-none placeholder:text-[hsl(var(--text-tertiary))]"
      />
    </div>
  );
}
