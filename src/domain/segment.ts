import type { Clause } from './schemas';
export function segmentBrief(brief: string): { clauses: Clause[]; capped: boolean } {
  const clauses: Clause[] = [];
  let capped = false;
  function add(start: number, end: number) {
    const text = brief.slice(start, end);
    const leading = text.length - text.trimStart().length;
    start += leading;
    end -= text.length - text.trimEnd().length;
    if (end <= start) return;
    if (clauses.length === 120) { capped = true; return; }
    clauses.push({ id: `C${clauses.length + 1}`, start, end, text: brief.slice(start, end) });
  }
  let offset = 0;
  for (const line of brief.split('\n')) {
    if (line.trim().length > 280) {
      let partStart = 0;
      for (const match of line.matchAll(/(?<=[.!?;])\s+(?=[A-Z0-9"“(])/g)) {
        add(offset + partStart, offset + match.index);
        partStart = match.index + match[0].length;
      }
      add(offset + partStart, offset + line.length);
    } else add(offset, offset + line.length);
    offset += line.length + 1;
  }
  return { clauses, capped };
}
