import { cn } from "@/lib/utils";

type Tone = "light" | "dark";

interface IconProps {
  className?: string;
  /** The surface behind the artwork. */
  tone?: Tone;
  /** Accessible name. Omit for decorative usage. */
  title?: string;
}

const brandAssets = {
  light: {
    mark: "/jenri/jerin-mark-light-surface.svg",
    logo: "/jenri/jerin-logo-light-surface.svg",
  },
  dark: {
    mark: "/jenri/jerin-mark.svg",
    logo: "/jenri/jenri-logo.svg",
  },
};

export function OrdoIcon({ className, tone = "light", title }: IconProps) {
  return (
    <img
      src={brandAssets[tone].mark}
      alt={title ?? ""}
      width={29}
      height={38}
      className={cn("h-6 w-6 object-contain", className)}
    />
  );
}

interface LogoProps extends IconProps {
  iconOnly?: boolean;
}

export function OrdoLogo({ className, tone = "light", iconOnly, title = "Jerin" }: LogoProps) {
  if (iconOnly) return <OrdoIcon className={className} tone={tone} title={title} />;

  return (
    <img
      src={brandAssets[tone].logo}
      alt={title}
      width={110}
      height={38}
      className={cn("h-7 w-auto object-contain", className)}
    />
  );
}
