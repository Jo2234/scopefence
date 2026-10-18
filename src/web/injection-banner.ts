import type { Injection } from "../domain";

export function formatInjectionBanner(
  message: string,
  spans: ReadonlyArray<Injection["spans"][number]>,
): string {
  const texts = new Set<string>();
  for (const { start, end } of spans) {
    // detectInjection uses JavaScript string offsets into analysis.input.message,
    // with an exclusive end. Reject invalid ranges instead of clamping them.
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      end > message.length
    ) {
      continue;
    }
    const text = message.slice(start, end);
    if (text.trim()) texts.add(text);
  }
  const quotes = [...texts].map((text) => {
    const characters = Array.from(text);
    const capped =
      characters.length > 80
        ? `${characters.slice(0, 79).join("")}…`
        : text;
    return `“${capped}”`;
  });
  const introduction =
    "This message contains text that looks like instructions to an AI";
  const detectedText = quotes.length ? `: ${quotes.join(", ")}` : "";
  return `${introduction}${detectedText}. ScopeFence treats it as client text only. Items marked included need your manual confirmation.`;
}
