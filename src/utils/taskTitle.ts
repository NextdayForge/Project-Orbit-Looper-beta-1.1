export function normalizeTaskTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}
