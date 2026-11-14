const MENTION_TOKEN = /@\[([^\]\n]{1,80})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export function mentionToken(name: string, userId: string) {
  return `@[${name.replace(/[\]\n]/g,"").slice(0,80)}](${userId})`;
}

export function mentionUserIds(content: string): string[] {
  return [...new Set(Array.from(content.matchAll(MENTION_TOKEN), m=>m[2].toLowerCase()))].slice(0,10);
}

export function displayMentions(content: string): string {
  return content.replace(MENTION_TOKEN, (_whole, name: string) => `@${name}`);
}
