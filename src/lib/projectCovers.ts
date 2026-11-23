export const projectCovers = [
  { id: "architecture", name: "Sandstone architecture", extension: "jpg" },
  { id: "wildflowers", name: "Wildflower meadow", extension: "png" },
  { id: "alpine-stream", name: "Alpine stream", extension: "png" },
  { id: "highland-road", name: "Highland road", extension: "png" },
  { id: "cliffs", name: "Mountain cliffs", extension: "png" },
  { id: "mountain-drive", name: "Mountain drive", extension: "png" },
] as const;

export type ProjectCoverId = typeof projectCovers[number]["id"];

export function projectCover(projectId: string, selected?: string | null) {
  const chosen = projectCovers.find(cover => cover.id === selected);
  if (chosen) return chosen;
  // Project UUIDs distribute covers across the collection and keep each choice stable across devices.
  let hash = 0;
  for (const character of projectId) hash = (Math.imul(31, hash) + character.charCodeAt(0)) >>> 0;
  return projectCovers[hash % projectCovers.length];
}

export function projectCoverUrl(cover: typeof projectCovers[number]) {
  return `/jenri/covers/${cover.id}.${cover.extension}`;
}
