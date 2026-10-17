import type { ReactNode } from "react";
import type { Analysis, AnalysisItem, Span } from "../../domain";

// Split at every boundary so overlapping selected and injection spans are both visible.
function highlighted(
  text: string,
  offset: number,
  selected: Span | null,
  injection: Span[] = [],
): ReactNode {
  const end = offset + text.length;
  const ranges = [selected, ...injection].filter(
    (s): s is Span => !!s && s.start < end && s.end > offset,
  );
  const boundaries = [
    ...new Set([
      offset,
      end,
      ...ranges.flatMap((s) => [
        Math.max(offset, s.start),
        Math.min(end, s.end),
      ]),
    ]),
  ].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, i) => {
    const stop = boundaries[i + 1]!;
    const content = text.slice(start - offset, stop - offset);
    const amber = injection.some((s) => s.start < stop && s.end > start);
    const active = !!selected && selected.start < stop && selected.end > start;
    return amber || active ? (
      <mark
        key={start}
        className={amber ? "injection-mark" : ""}
        data-selected={active || undefined}
      >
        {content}
      </mark>
    ) : (
      <span key={start}>{content}</span>
    );
  });
}
export function BriefViewer({
  analysis,
  selected,
}: {
  analysis: Analysis;
  selected: AnalysisItem | null;
}) {
  return (
    <section
      className="panel brief-viewer"
      aria-labelledby="brief-viewer-heading"
    >
      <div className="section-heading">
        <h2 id="brief-viewer-heading">Brief &amp; message evidence</h2>
        <span className="muted small-text">
          {selected ? `Selected ${selected.id}` : "Select a table row"}
        </span>
      </div>
      <div className="evidence-documents">
        <div className="document">
          <h3>Agreed brief</h3>
          <div className="clauses">
            {analysis.clauses.map((c) => (
              <p
                key={c.id}
                className={
                  selected?.clause_id === c.id ? "selected-clause" : ""
                }
              >
                <span className="clause-id">{c.id}</span>
                <span>
                  {highlighted(c.text, c.start, selected?.brief_span ?? null)}
                </span>
              </p>
            ))}
          </div>
        </div>
        <div className="document">
          <h3>Client message</h3>
          <p className="message-copy">
            {highlighted(
              analysis.input.message,
              0,
              selected?.message_span ?? null,
              analysis.injection.spans,
            )}
          </p>
          <p className="muted small-text">
            Highlighted text is evidence for the selected row. Amber marks
            instruction-like text.
          </p>
        </div>
      </div>
    </section>
  );
}
