import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  defaultRateCard,
  priceOrder,
  RateCardSchema,
  type RateCard,
} from "../domain";
import demo from "../../fixtures/demo/demo-1.json";
import injectionDemo from "../../fixtures/demo/demo-injection.json";
import { analyse, AnalyseError, getHealth, type Health } from "./client";
import { initialState, inputKey, RATE_CARD_KEY, reducer } from "./state";
import { InputsPanel } from "./components/InputsPanel";
import { ModelChip, StatusBar } from "./components/StatusBar";
import { Banners, ErrorBanner } from "./components/Banners";
import { BriefViewer } from "./components/BriefViewer";
import { EvidenceTable } from "./components/EvidenceTable";
import { ChangeOrderPanel } from "./components/ChangeOrderPanel";

function savedCard(): RateCard {
  try {
    const saved = localStorage.getItem(RATE_CARD_KEY);
    if (saved) {
      const result = RateCardSchema.safeParse(JSON.parse(saved));
      if (result.success) return result.data;
    }
  } catch {
    /* Storage can be unavailable or contain an old schema. */
  }
  return defaultRateCard();
}
export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(savedCard()),
  );
  const [health, setHealth] = useState<Health | null>(null);
  const [healthVersion, setHealthVersion] = useState(0);
  const [formVersion, setFormVersion] = useState(0);
  const [storageNotice, setStorageNotice] = useState("");
  const [started, setStarted] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const active = useRef<AbortController | null>(null);
  const busy = state.phase === "analysing";
  const valid =
    !!state.brief.trim() && !!state.message.trim() && state.rate_valid;
  const order = useMemo(
    () =>
      state.analysis ? priceOrder(state.analysis.items, state.rate_card) : null,
    [state.analysis, state.rate_card],
  );
  const changed =
    state.analysed_inputs !== null &&
    (!state.rate_valid ||
      state.analysed_inputs !==
        inputKey(state.brief, state.message, state.rate_card));
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      let next: Health | null = null;
      try {
        next = await getHealth(controller.signal);
        if (!controller.signal.aborted) setHealth(next);
      } catch {
        if (!controller.signal.aborted)
          setHealth({
            ok: false,
            mode: "live",
            model: {
              status: "unreachable",
              id: "unknown",
              file: null,
              runtime: "llama.cpp",
              is_gemma: false,
              registered: false,
            },
            limits: { brief_chars: 8000, message_chars: 4000 },
            prompt_version: "",
          });
      }
      if (!controller.signal.aborted)
        timer = setTimeout(poll, next?.model.status === "ready" ? 30000 : 5000);
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [healthVersion]);
  useEffect(() => {
    if (!busy) return;
    setElapsed(Math.floor((Date.now() - started) / 1000));
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [busy, started]);
  useEffect(() => () => active.current?.abort(), []);
  function save(card: RateCard) {
    try {
      localStorage.setItem(RATE_CARD_KEY, JSON.stringify(card));
      setStorageNotice("");
    } catch {
      setStorageNotice(
        "Browser storage is unavailable. Your rate card is kept for this session only.",
      );
    }
  }
  function rate(card: RateCard | null) {
    dispatch({ type: "rate", card });
    if (card) save(card);
  }
  function loadDemo(injection: boolean) {
    const data = injection ? injectionDemo : demo;
    const card = RateCardSchema.parse(data.rate_card);
    dispatch({
      type: "demo",
      brief: data.brief,
      message: data.message,
      rate_card: card,
    });
    setFormVersion((v) => v + 1);
    save(card);
  }
  async function run() {
    if (!valid || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setStarted(Date.now());
    setElapsed(0);
    dispatch({ type: "start" });
    try {
      const analysis = await analyse(
        {
          brief: state.brief,
          message: state.message,
          rate_card: state.rate_card,
        },
        controller.signal,
      );
      if (active.current === controller && !controller.signal.aborted)
        dispatch({ type: "success", analysis });
    } catch (error) {
      if (active.current === controller && !controller.signal.aborted) {
        if (error instanceof AnalyseError && error.error.code === "cancelled")
          dispatch({ type: "cancel" });
        else
          dispatch({
            type: "failure",
            error:
              error instanceof AnalyseError
                ? error.error
                : { code: "internal" },
          });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }
  function cancel() {
    active.current?.abort();
    active.current = null;
    dispatch({ type: "cancel" });
  }
  function retry() {
    setHealthVersion((v) => v + 1);
    if (valid) void run();
  }
  function forget() {
    try {
      localStorage.removeItem(RATE_CARD_KEY);
      setStorageNotice(
        "Saved rate card forgotten. The current form is kept until you close this page.",
      );
    } catch {
      setStorageNotice("Browser storage is unavailable.");
    }
  }
  const healthUnreachable =
    health?.model.status === "unreachable" &&
    state.error?.code !== "model_unreachable";
  const extraBlock = !state.rate_valid
    ? "Fix the rate card before exporting"
    : Object.keys(state.edit_errors).length
      ? "Fix the row edit errors before exporting"
      : null;
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <StatusBar health={health} analysis={state.analysis} />
      <main id="main">
        {healthUnreachable && (
          <ErrorBanner
            error={{ code: "model_unreachable" }}
            retry={retry}
            disabled={busy}
          />
        )}
        {health?.model.status === "loading" && (
          <p className="banner neutral" role="status">
            Model is loading into memory…
          </p>
        )}
        <div className={`workspace ${state.analysis ? "has-results" : ""}`}>
          <InputsPanel
            brief={state.brief}
            message={state.message}
            card={state.rate_card}
            formVersion={formVersion}
            busy={busy}
            valid={valid}
            limits={
              health?.limits ?? { brief_chars: 8000, message_chars: 4000 }
            }
            onText={(field, value) => dispatch({ type: "text", field, value })}
            onRate={rate}
            onDemo={loadDemo}
            onAnalyse={() => void run()}
            onForget={forget}
            storageNotice={storageNotice}
          />
          <div className="results">
            {busy && (
              <section
                className="panel loading-panel"
                aria-label="Analysing"
                role="status"
              >
                <div className="spinner" aria-hidden="true" />
                <h2>
                  Gemma is reading the message locally on this computer…{" "}
                  <span>{elapsed} s</span>
                </h2>
                <p>Usually about a minute on this laptop.</p>
                <ModelChip health={health} />
                <button type="button" onClick={cancel}>
                  Cancel
                </button>
              </section>
            )}
            {state.error && (
              <ErrorBanner
                error={state.error}
                retry={retry}
                disabled={!valid || busy}
              />
            )}
            {!state.analysis && !busy && !state.error && (
              <section className="panel empty-state">
                <span className="eyebrow">
                  From request to reviewed change order
                </span>
                <h1>
                  Check the brief.
                  <br />
                  Keep the scope clear.
                </h1>
                <p>
                  Paste the agreed brief and the client's new message, or load
                  the synthetic demo.
                </p>
                <ol>
                  <li>Gemma maps requests to the brief.</li>
                  <li>You check the quoted evidence and prices.</li>
                  <li>Download the change order when every row is reviewed.</li>
                </ol>
                <p className="muted small-text">
                  Your judgement stays at the centre. A verified quote confirms
                  the words are in the brief; it does not confirm the model’s
                  interpretation.
                </p>
              </section>
            )}
            {state.analysis && order && (
              <fieldset
                key={state.analysis.id}
                className="results-content"
                disabled={busy}
                aria-label="Analysis results"
              >
                <Banners analysis={state.analysis} changed={changed} />
                <div className="analysis-meta">
                  <span>{state.analysis.reference}</span>
                  <span>
                    {state.analysis.model.id} ·{" "}
                    {state.analysis.mode === "fixture"
                      ? "fixture replay"
                      : "analysis"}{" "}
                    {(state.analysis.latency_ms / 1000).toFixed(1)} s ·{" "}
                    {state.analysis.attempts}{" "}
                    {state.analysis.attempts === 1 ? "attempt" : "attempts"}
                  </span>
                </div>
                <BriefViewer
                  analysis={state.analysis}
                  selected={
                    state.analysis.items.find((i) => i.id === state.selected) ??
                    null
                  }
                />
                <EvidenceTable
                  items={state.analysis.items}
                  card={state.rate_card}
                  order={order}
                  selected={state.selected}
                  errors={state.edit_errors}
                  notices={state.notices}
                  onSelect={(id) => dispatch({ type: "select", id })}
                  onEdit={(id, edit) => dispatch({ type: "edit", id, edit })}
                  onApproveAll={() => dispatch({ type: "approve_remaining" })}
                />
                <details className="panel raw-output">
                  <summary>Raw Gemma output</summary>
                  <pre>{state.analysis.raw_model_output}</pre>
                </details>
                <ChangeOrderPanel
                  order={order}
                  card={state.rate_card}
                  analysis={state.analysis}
                  extraBlock={extraBlock}
                />
              </fieldset>
            )}
          </div>
        </div>
      </main>
      <footer>
        ScopeFence · Runs locally. No sending, accounts or telemetry.{" "}
        <span>This is not legal advice.</span>
      </footer>
    </>
  );
}
