import type { Clause, Span } from './schemas';
export function findExact(haystack: string, needle: string): Span | null {
  if (!needle.length) return null;
  const start = haystack.indexOf(needle);
  return start < 0 ? null : { start, end: start + needle.length };
}
export function overlapLen(a: Span, b: Span): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}
export function clauseAt(clauses: Clause[], offset: number): Clause | null {
  return clauses.find(c => c.start <= offset && offset < c.end) ?? null;
}
export function normaliseForDedupe(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
