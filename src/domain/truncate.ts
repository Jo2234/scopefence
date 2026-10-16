export const LIMITS = { brief_chars: 8000, message_chars: 4000 } as const;
function cut(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const prefix = text.slice(0, limit);
  let whitespace = -1;
  for (let i = prefix.length - 1; i >= Math.max(0, limit - 200); i--) {
    if (/\s/.test(prefix[i]!)) { whitespace = i; break; }
  }
  return whitespace < 0 ? prefix : prefix.slice(0, whitespace);
}
export function truncateInputs(brief: string, message: string) {
  const brief_analysed = cut(brief, LIMITS.brief_chars);
  const message_analysed = cut(message, LIMITS.message_chars);
  return { brief_analysed, message_analysed, truncated: {
    brief: brief_analysed.length < brief.length, message: message_analysed.length < message.length,
    brief_dropped_chars: brief.length - brief_analysed.length, message_dropped_chars: message.length - message_analysed.length,
  } };
}
