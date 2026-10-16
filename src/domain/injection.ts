import type { Injection } from './schemas';
const patterns = [
  ['ignore_instructions', /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(instructions?|rules|prompt|guidelines|system)\b/gi],
  ['mark_all_included', /\b(mark|label|classify|treat|count)\b[^.\n]{0,30}\b(everything|all|every (item|request|change)|it all)\b[^.\n]{0,30}\b(included|in[- ]scope|free|covered)\b/gi],
  ['role_hijack', /\b(you are now|act as|as an ai|ai assistant[:,]|assistant:|system:)/gi],
  ['price_override', /\b(set|make|change)\b[^.\n]{0,20}\b(price|rate|total|cost|hours)\b[^.\n]{0,20}\b(to|=)\s*(\$|0|zero|free)/gi],
  ['output_override', /\b(respond|reply|output|return)\b[^.\n]{0,20}\b(only|just)\b[^.\n]{0,20}\b(json|with)\b/gi],
] as const;
export function detectInjection(message: string): Injection {
  const spans: Injection['spans'] = [];
  for (const [pattern, regex] of patterns) {
    for (const match of message.matchAll(regex)) spans.push({ start: match.index, end: match.index + match[0].length, pattern });
  }
  spans.sort((a, b) => a.start - b.start || a.end - b.end || a.pattern.localeCompare(b.pattern));
  return { suspected: spans.length > 0, spans };
}
