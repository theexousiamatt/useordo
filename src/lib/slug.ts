export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function uniqueSlug(input: string): string {
  const base = slugify(input) || "workspace";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
