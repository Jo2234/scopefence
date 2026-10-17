import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatMoney,
  renderHtml,
  renderMarkdown,
  type Analysis,
  type OrderMeta,
  type PricedOrder,
  type RateCard,
} from "../../domain";

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function download(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ChangeOrderPanel({
  order,
  card,
  analysis,
  extraBlock,
}: {
  order: PricedOrder;
  card: RateCard;
  analysis: Analysis;
  extraBlock: string | null;
}) {
  const meta = useMemo<OrderMeta>(
    () => ({
      reference: analysis.reference,
      date_iso: localDate(),
      project_name: card.project_name,
      client_name: card.client_name,
      freelancer_name: card.freelancer_name,
    }),
    [analysis.reference, card],
  );
  const generated = useMemo(() => renderMarkdown(order, meta), [order, meta]);
  const html = useMemo(() => renderHtml(order, meta), [order, meta]);
  const [markdown, setMarkdown] = useState(generated);
  const [source, setSource] = useState(generated);
  const dirty = markdown !== source;
  const stale = source !== generated;
  const currentMarkdown = !dirty && stale ? generated : markdown;
  useEffect(() => {
    if (!dirty && stale) {
      setMarkdown(generated);
      setSource(generated);
    }
  }, [dirty, stale, generated]);
  const [printError, setPrintError] = useState("");
  const printWindow = useRef<Window | null>(null);
  useEffect(
    () => () => {
      printWindow.current = null;
    },
    [],
  );
  const firstError = order.errors[0];
  const rowNumber = firstError
    ? analysis.items.findIndex((i) => i.id === firstError.item_id) + 1
    : 0;
  const reason =
    extraBlock ??
    (firstError
      ? firstError.code.startsWith("hours_")
        ? `Enter hours for row ${rowNumber}`
        : firstError.code === "quantity_invalid"
          ? `Enter a valid quantity for row ${rowNumber}`
          : `Choose a deliverable for row ${rowNumber}`
      : order.unreviewed_count
        ? `Review ${order.unreviewed_count} more ${order.unreviewed_count === 1 ? "row" : "rows"}`
        : null);
  const disabled = !order.exportable || reason !== null;
  function print() {
    const win = window.open("", "_blank");
    if (!win) {
      setPrintError("Allow the print window to open, then try Print again.");
      return;
    }
    printWindow.current = win;
    win.opener = null;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    setPrintError("");
  }
  return (
    <section className="panel change-order" aria-labelledby="order-heading">
      <div className="section-heading">
        <h2 id="order-heading">
          <span className="step">3</span> Change order
        </h2>
        <span className={`order-state ${disabled ? "" : "ready"}`}>
          {disabled ? "Review in progress" : "Ready to download"}
        </span>
      </div>
      <div className="order-summary">
        <div>
          <span className="muted small-text">Approved total</span>
          <strong data-testid="order-total">
            {formatMoney(order.total_minor, order.currency)}
          </strong>
        </div>
        <div>
          <strong>{order.lines.length}</strong> additional ·{" "}
          <strong>{order.covered.length}</strong> covered ·{" "}
          <strong>{order.questions.length}</strong>{" "}
          {order.questions.length === 1 ? "question" : "questions"}
          <p className="small-text">
            Revision rounds: {order.revision.used_before} of{" "}
            {order.revision.included} used before this message.{" "}
            {order.revision.used_by_this_message
              ? "This message uses 1 round."
              : "No round used by this message yet."}{" "}
            {order.revision.remaining_after} remaining.
            {order.revision.beyond_allowance &&
              " Revisions beyond the allowance are billed."}
          </p>
        </div>
      </div>
      <label className="preview-label" htmlFor="html-preview">
        HTML preview
      </label>
      <iframe
        id="html-preview"
        title="Change order HTML preview"
        sandbox=""
        srcDoc={html}
      />
      <div className="section-heading">
        <label htmlFor="markdown">Editable Markdown</label>
        {dirty && (
          <span className="muted small-text">Your text edits are kept</span>
        )}
      </div>
      {dirty && stale && (
        <button
          type="button"
          className="regenerate"
          onClick={() => {
            setMarkdown(generated);
            setSource(generated);
          }}
        >
          Regenerate from table (overwrites your text edits)
        </button>
      )}
      <textarea
        id="markdown"
        aria-label="Editable Markdown"
        className="markdown"
        value={currentMarkdown}
        rows={12}
        spellCheck={false}
        onChange={(e) => setMarkdown(e.target.value)}
      />
      {reason && (
        <p id="export-reason" className="banner warning" role="status">
          {reason}
        </p>
      )}
      <div className="button-row export-buttons">
        <button
          type="button"
          className="primary"
          disabled={disabled}
          aria-describedby={reason ? "export-reason" : undefined}
          onClick={() =>
            download(
              currentMarkdown,
              "text/markdown;charset=utf-8",
              `change-order-${analysis.reference}.md`,
            )
          }
        >
          Download .md
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-describedby={reason ? "export-reason" : undefined}
          onClick={() =>
            download(
              html,
              "text/html;charset=utf-8",
              `change-order-${analysis.reference}.html`,
            )
          }
        >
          Download .html
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-describedby={reason ? "export-reason" : undefined}
          onClick={print}
        >
          Print
        </button>
      </div>
      <p className="muted small-text">
        HTML is generated from the table. Markdown downloads contain your text
        edits.
      </p>
      <p className="small-text">
        Nothing is sent. Download it and send it yourself.
      </p>
      {printError && (
        <p role="alert" className="field-error">
          {printError}
        </p>
      )}
    </section>
  );
}
