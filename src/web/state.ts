import {
  applyEdit,
  EditError,
  priceOrder,
  type Analysis,
  type ItemEdit,
  type RateCard,
} from "../domain";
import type { ApiError } from "./client";

export const RATE_CARD_KEY = "scopefence.rate_card.v1";
export type Phase =
  | "empty"
  | "analysing"
  | "reviewing"
  | "order_ready"
  | "error";
export type State = {
  phase: Phase;
  brief: string;
  message: string;
  rate_card: RateCard;
  rate_valid: boolean;
  analysis: Analysis | null;
  analysed_inputs: string | null;
  selected: string | null;
  error: ApiError | null;
  edit_errors: Record<string, string>;
  notices: Record<string, string>;
  previous: { phase: Phase; error: ApiError | null } | null;
};
export type Action =
  | { type: "text"; field: "brief" | "message"; value: string }
  | { type: "rate"; card: RateCard | null }
  | { type: "demo"; brief: string; message: string; rate_card: RateCard }
  | { type: "start" }
  | { type: "cancel" }
  | { type: "success"; analysis: Analysis }
  | { type: "failure"; error: ApiError }
  | { type: "select"; id: string }
  | { type: "edit"; id: string; edit: ItemEdit }
  | { type: "approve_remaining" };

export function inputKey(
  brief: string,
  message: string,
  card: RateCard,
): string {
  return JSON.stringify([brief, message, card]);
}
export function initialState(card: RateCard): State {
  return {
    phase: "empty",
    brief: "",
    message: "",
    rate_card: card,
    rate_valid: true,
    analysis: null,
    analysed_inputs: null,
    selected: null,
    error: null,
    edit_errors: {},
    notices: {},
    previous: null,
  };
}
function reviewed(state: State): State {
  if (!state.analysis) return state;
  return {
    ...state,
    phase:
      state.rate_valid &&
      Object.keys(state.edit_errors).length === 0 &&
      priceOrder(state.analysis.items, state.rate_card).exportable
        ? "order_ready"
        : "reviewing",
  };
}
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "text":
      return { ...state, [action.field]: action.value };
    case "rate":
      return reviewed({
        ...state,
        rate_card: action.card ?? state.rate_card,
        rate_valid: action.card !== null,
      });
    case "demo":
      return reviewed({
        ...state,
        brief: action.brief,
        message: action.message,
        rate_card: action.rate_card,
        rate_valid: true,
      });
    case "start":
      return {
        ...state,
        phase: "analysing",
        error: null,
        previous: { phase: state.phase, error: state.error },
      };
    case "cancel":
      return {
        ...state,
        phase:
          state.previous?.phase ?? (state.analysis ? "reviewing" : "empty"),
        error: state.previous?.error ?? null,
        previous: null,
      };
    case "success":
      return reviewed({
        ...state,
        phase: "reviewing",
        analysis: action.analysis,
        analysed_inputs: inputKey(state.brief, state.message, state.rate_card),
        selected: action.analysis.items[0]?.id ?? null,
        error: null,
        previous: null,
        edit_errors: {},
        notices: {},
      });
    case "failure":
      return { ...state, phase: "error", error: action.error, previous: null };
    case "select":
      return { ...state, selected: action.id };
    case "edit": {
      if (!state.analysis) return state;
      const item = state.analysis.items.find((i) => i.id === action.id);
      if (!item) return state;
      const key = `${item.id}.${Object.keys(action.edit)[0]}`;
      try {
        const next = applyEdit(item, action.edit, state.rate_card);
        const errors = { ...state.edit_errors };
        delete errors[key];
        const overriding =
          "review" in action.edit &&
          action.edit.review === "proposed" &&
          item.review === "excluded" &&
          (item.duplicate_of !== null || item.injection_overlap);
        return reviewed({
          ...state,
          analysis: {
            ...state.analysis,
            items: state.analysis.items.map((i) =>
              i.id === item.id ? next : i,
            ),
          },
          edit_errors: errors,
          notices: overriding
            ? {
                ...state.notices,
                [item.id]:
                  "Re-included by you, overriding the duplicate or instruction-text guard. Review before approving.",
              }
            : state.notices,
        });
      } catch (error) {
        const message =
          error instanceof EditError ? error.message : "invalid_input";
        return reviewed({
          ...state,
          edit_errors: { ...state.edit_errors, [key]: message },
        });
      }
    }
    case "approve_remaining": {
      if (!state.analysis) return state;
      return reviewed({
        ...state,
        analysis: {
          ...state.analysis,
          items: state.analysis.items.map((i) =>
            i.review === "proposed"
              ? applyEdit(i, { review: "approved" }, state.rate_card)
              : i,
          ),
        },
      });
    }
  }
}
