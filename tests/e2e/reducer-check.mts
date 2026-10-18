import assert from "node:assert/strict";
import test from "node:test";
import demo from "../../fixtures/demo/demo-1.json";
import { analyse } from "../../src/model/analyse";
import { FixtureAdapter } from "../../src/model/fixture";
import { RateCardSchema, priceOrder } from "../../src/domain";
import { initialState, reducer } from "../../src/web/state";

const card = RateCardSchema.parse(demo.rate_card);
const result = await analyse(
  { brief: demo.brief, message: demo.message, rate_card: card },
  new FixtureAdapter(),
);
if (!result.ok)
  throw new Error(
    `Recorded fixture could not be analysed: ${result.error.code}`,
  );
const loaded = reducer(initialState(card), {
  type: "demo",
  ...demo,
  rate_card: card,
});
const reviewing = reducer(reducer(loaded, { type: "start" }), {
  type: "success",
  analysis: result.analysis,
});

test("cancel restores empty, reviewing, ready and previous error phases without losing inputs or edits", () => {
  const emptyCancel = reducer(reducer(loaded, { type: "start" }), {
    type: "cancel",
  });
  assert.equal(emptyCancel.phase, "empty");
  assert.equal(emptyCancel.brief, demo.brief);
  assert.equal(emptyCancel.message, demo.message);
  const edited = reducer(reviewing, {
    type: "edit",
    id: "I1",
    edit: { hours: "3" },
  });
  const ready = reducer(edited, { type: "approve_remaining" });
  assert.equal(ready.phase, "order_ready");
  assert.equal(priceOrder(ready.analysis!.items, card).total_minor, 71000);
  const failed = reducer(reducer(ready, { type: "start" }), {
    type: "failure",
    error: { code: "model_timeout" },
  });
  for (const before of [reviewing, ready, failed]) {
    const after = reducer(reducer(before, { type: "start" }), {
      type: "cancel",
    });
    assert.equal(after.phase, before.phase);
    assert.deepEqual(after.analysis, before.analysis);
    assert.deepEqual(after.error, before.error);
    assert.equal(after.brief, before.brief);
    assert.equal(after.message, before.message);
  }
});

test("invalid edits keep the valid item and stop ready status until corrected", () => {
  const ready = reducer(reviewing, { type: "approve_remaining" });
  const invalid = reducer(ready, {
    type: "edit",
    id: "I1",
    edit: { hours: "0" },
  });
  assert.equal(invalid.phase, "reviewing");
  assert.equal(invalid.edit_errors["I1.hours"], "hours_invalid");
  assert.deepEqual(invalid.analysis, ready.analysis);
  const corrected = reducer(invalid, {
    type: "edit",
    id: "I1",
    edit: { hours: "2.5" },
  });
  assert.equal(corrected.phase, "order_ready");
  assert.deepEqual(corrected.edit_errors, {});
  assert.equal(corrected.analysis!.items[0]!.pricing.hours_hundredths, 250);
});

test("excluded rows require re-inclusion and Approve all never approves them", () => {
  const excluded = reducer(reviewing, {
    type: "edit",
    id: "I1",
    edit: { review: "excluded" },
  });
  const all = reducer(excluded, { type: "approve_remaining" });
  assert.equal(all.analysis!.items[0]!.review, "excluded");
  assert.equal(priceOrder(all.analysis!.items, card).total_minor, 47000);
  const refused = reducer(all, {
    type: "edit",
    id: "I1",
    edit: { review: "approved" },
  });
  assert.equal(refused.edit_errors["I1.review"], "invalid_input");
  assert.equal(refused.analysis!.items[0]!.review, "excluded");
  const proposed = reducer(refused, {
    type: "edit",
    id: "I1",
    edit: { review: "proposed" },
  });
  assert.equal(proposed.phase, "reviewing");
  assert.equal(proposed.analysis!.items[0]!.review, "proposed");
  const approved = reducer(proposed, {
    type: "edit",
    id: "I1",
    edit: { review: "approved" },
  });
  assert.equal(approved.phase, "order_ready");
});

test("re-including guarded rows surfaces the override and retains injection evidence", () => {
  const guarded = {
    ...reviewing,
    analysis: {
      ...reviewing.analysis!,
      items: reviewing.analysis!.items.map((item, i) =>
        i === 0
          ? {
              ...item,
              review: "excluded" as const,
              duplicate_of: "I2",
              injection_overlap: true,
            }
          : item,
      ),
    },
  };
  const proposed = reducer(guarded, {
    type: "edit",
    id: "I1",
    edit: { review: "proposed" },
  });
  assert.equal(proposed.analysis!.items[0]!.review, "proposed");
  assert.equal(proposed.analysis!.items[0]!.duplicate_of, null);
  assert.equal(proposed.analysis!.items[0]!.injection_overlap, true);
  assert.match(
    proposed.notices.I1!,
    /overriding the duplicate or instruction-text guard/,
  );
  assert.equal(proposed.phase, "reviewing");
});
