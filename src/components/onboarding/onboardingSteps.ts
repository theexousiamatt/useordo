import {
  Sparkles,
  Building2,
  Users,
  UserPlus,
  FolderKanban,
  Compass,
  CheckCircle2,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceType = "freelancer" | "agency" | "consultant" | "startup" | "other";

export interface OnboardingStepMeta {
  id: number;
  /** Short label for the stepper. */
  label: string;
  icon: LucideIcon;
}

/** The canonical Ordo onboarding flow. */
export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  { id: 1, label: "Welcome", icon: Sparkles },
  { id: 2, label: "Workspace", icon: Building2 },
  { id: 3, label: "Type", icon: LayoutDashboard },
  { id: 4, label: "Team", icon: Users },
  { id: 5, label: "Clients", icon: UserPlus },
  { id: 6, label: "Project", icon: FolderKanban },
  { id: 7, label: "Tour", icon: Compass },
  { id: 8, label: "Done", icon: CheckCircle2 },
];

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

export interface WorkspaceTypeOption {
  value: WorkspaceType;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const WORKSPACE_TYPES: WorkspaceTypeOption[] = [
  { value: "freelancer", label: "Freelancer", description: "Solo, running your own show", icon: Sparkles },
  { value: "agency", label: "Agency", description: "A team delivering for clients", icon: Building2 },
  { value: "consultant", label: "Consultant", description: "Advisory & expert services", icon: Compass },
  { value: "startup", label: "Startup", description: "Building and scaling fast", icon: LayoutDashboard },
  { value: "other", label: "Other", description: "Something a little different", icon: FolderKanban },
];

export interface TourFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const TOUR_FEATURES: TourFeature[] = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "A calm, executive overview of everything moving across your workspace.",
  },
  {
    icon: Sparkles,
    title: "Action Center",
    description: "Everything that needs your attention, consolidated into one focused queue.",
  },
  {
    icon: FolderKanban,
    title: "Projects",
    description: "Native Kanban boards, milestones, and deliverables for every engagement.",
  },
  {
    icon: CheckCircle2,
    title: "Tasks",
    description: "Assign, prioritize, and track work with full accountability.",
  },
  {
    icon: Compass,
    title: "Activity",
    description: "A complete, trustworthy audit trail of everything that happens.",
  },
];
