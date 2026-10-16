import {it} from 'vitest';
// Domain stage A is not on main. These acceptance cases are intentionally TODO,
// not passing stand-ins; enable the real ScriptedAdapter assertions on integration.
it.todo('A18 invalid JSON, then valid → attempts 2 with issue text in repair prompt');
it.todo('A19 three invalid outputs → model_output_invalid and last raw output');
it.todo('A20 refusal text three times → model_output_invalid without fabricated items');
it.todo('A21 empty items → valid analysis with no_items_found warning');
it.todo('A22 unreachable adapter → no retry, model_unreachable');
