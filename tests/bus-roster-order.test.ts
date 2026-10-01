import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import * as React from 'react';
import ts from 'typescript';
import { ConvexError } from 'convex/values';
import { arrayMove } from '@dnd-kit/sortable';
import { busJourneyProgress, orderBusStudents } from '../lib/bus-roster-order';

test('journey focus rotates completed stops without changing the saved order and resets on completion', () => {
  const students = ['a', 'b', 'c'].map(id => ({ id, state: null as null | { status: string; updatedAt: number; boarding?: { at: number }; dropoff?: { at: number } } }));
  const view = (journey?: 'to_school') => busJourneyProgress(students, journey);
  assert.equal(view('to_school').next, 'a');
  assert.equal(view('to_school').canArrive, false);
  students[1].state = { status: 'boarded', updatedAt: 1, boarding: { at: 1 } };
  students[0].state = { status: 'boarded', updatedAt: 2, boarding: { at: 2 } };
  assert.deepEqual(view('to_school').students.map(s => s.id), ['c', 'b', 'a']);
  assert.equal(view('to_school').next, 'c');
  assert.equal(view().next, 'a', 'Return boarding is individual and does not rotate until drop-off');
  students[2].state = { status: 'not_traveling', updatedAt: 3 };
  assert.equal(view('to_school').canArrive, true);
  assert.equal(view('to_school').next, undefined);
  students[0].state.dropoff = { at: 4 };
  assert.equal(view().next, 'b');
  assert.equal(view().students.at(-1)?.id, 'a');
  students[1].state.dropoff = { at: 5 };
  for (const journey of [undefined, 'to_school'] as const) {
    assert.equal(view(journey).complete, true);
    assert.deepEqual(view(journey).students.map(s => s.id), ['a', 'b', 'c']);
    assert.equal(view(journey).next, undefined);
  }
  assert.equal(view('to_school').canArrive, false);
  students[0].state = null;
  assert.equal(view('to_school').next, 'a', 'Undo reopens the next unresolved stop');
  assert.equal(busJourneyProgress([{ id: 'x', state: null, journeyBlocked: true }]).next, undefined);
  const blocked = busJourneyProgress([{ id: 'blocked', state: null, journeyBlocked: true }, { id: 'ready', state: null }]);
  assert.equal(blocked.students[0].id, blocked.next, 'A blocked stop cannot hide the next actionable student');
  assert.equal(blocked.complete, false);
  assert.equal(busJourneyProgress([]).complete, false);
});

test('saved order is immutable and appends new members without retaining removed members', () => {
  const students = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(orderBusStudents(students, ['removed', 'b', 'a']).map(s => s.id), ['b', 'a', 'c']);
  assert.deepEqual(students.map(s => s.id), ['a', 'b', 'c']);
});

test('drag snapshots, cancellation, optimistic scoping, rollback errors and tap alternatives', async () => {
  const file = '../components/dismissal/bus-roster-order.tsx';
  const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const declarations = source.statements.filter(node => ts.isFunctionDeclaration(node) || ts.isVariableStatement(node));
  const { outputText } = ts.transpileModule(`${declarations.map(node => node.getText(source).replace(/^export /, '')).join('\n')}; ({ BusRosterOrder, SortableStudent });`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  });
  type Element = React.ReactElement<Record<string, any>>;
  const state: unknown[] = [];
  let cursor = 0;
  let fail: Error | null = null;
  let optimistic: any;
  const calls: any[] = [];
  const mutate = Object.assign(async (args: any) => { calls.push(args); if (fail) throw fail; }, {
    withOptimisticUpdate: (callback: any) => { optimistic = callback; return mutate; },
  });
  const components = runInNewContext(outputText, {
    React, ConvexError, arrayMove, orderBusStudents,
    useId: () => 'sort-test', useTranslations: () => (key: string) => key,
    useState: (initial: unknown) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value: unknown) => { state[index] = value; }];
    },
    useMutation: () => mutate,
    api: { studentDismissals: { getRoster: 'roster', reorderRoster: 'reorder' } },
    useSensor: (sensor: any, options: any) => ({ sensor, options }), useSensors: (...sensors: any[]) => sensors,
    useSortable: () => ({ attributes: { role: 'button' }, listeners: { onPointerDown() {} } }),
    CSS: { Translate: { toString: () => undefined } },
    ...Object.fromEntries(['DndContext', 'DragOverlay', 'KeyboardSensor', 'MouseSensor', 'TouchSensor', 'closestCenter', 'SortableContext', 'sortableKeyboardCoordinates', 'verticalListSortingStrategy', 'Button', 'Popover', 'PopoverTrigger', 'PopoverContent', 'GripVertical', 'ArrowUp', 'ArrowDown'].map(key => [key, key])),
  });
  const roster = { students: ['a', 'b', 'c'].map(id => ({ id, name: id })), orderRevision: 3 };
  const props = { roster, campus: 'School', carNumber: 'BUS', date: '2026-09-30', journey: 'to_school', renderStudent: (_s: any, handle: any) => handle };
  function render() {
    cursor = 0;
    const elements: Element[] = [];
    function visit(node: React.ReactNode) {
      React.Children.forEach(node, child => {
        if (!React.isValidElement<Record<string, any>>(child)) return;
        elements.push(child);
        visit(child.props.children);
      });
    }
    visit(components.BusRosterOrder(props));
    return elements;
  }
  const context = () => render().find(n => n.type === 'DndContext')!.props;
  assert.equal(render().some(n => n.type === 'p' && n.props.children === 'hint'), false);
  assert.equal(render().find(n => n.type === 'ul')!.props['aria-describedby'], undefined);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const sensors = context().sensors;
  assert.deepEqual(JSON.parse(JSON.stringify(sensors[1].options)), { activationConstraint: { delay: 200, tolerance: 8 } });
  assert.equal(sensors[2].options.coordinateGetter, 'sortableKeyboardCoordinates');
  context().onDragStart({ active: { id: 'a' } });
  roster.orderRevision = 4;
  roster.students.reverse();
  assert.deepEqual(Array.from(render().find(n => n.type === 'SortableContext')!.props.items), ['a', 'b', 'c'], 'Live updates do not shift an active drag');
  context().onDragEnd({ active: { id: 'a' }, over: { id: 'c' } });
  await flush();
  assert.deepEqual(Array.from(calls[0].studentIds), ['b', 'c', 'a']);
  assert.equal(calls[0].expectedRevision, 3, 'Snapshot revision prevents overwriting concurrent changes');
  assert.equal(calls[0].journey, 'to_school');
  for (const over of [null, { id: 'c' }]) {
    context().onDragStart({ active: { id: 'c' } });
    context().onDragEnd({ active: { id: 'c' }, over });
  }
  context().onDragStart({ active: { id: 'b' } });
  context().onDragCancel();
  assert.equal(calls.length, 1, 'Cancellation, outside drops and unchanged positions do not save');
  const args = { campus: props.campus, carNumber: props.carNumber, date: props.date, journey: props.journey, historical: false };
  const queries = [args, { ...args, journey: undefined }, { ...args, campus: 'Other' }, { ...args, historical: true }, { ...args, date: '2026-09-29' }, { ...args, carNumber: 'OTHER' }];
  const writes: any[] = [];
  optimistic({ getAllQueries: () => queries.map(args => ({ args, value: roster })), setQuery: (...values: any[]) => writes.push(values) }, calls[0]);
  assert.equal(writes.length, 1, 'Optimistic updates affect only this live bus/campus/journey');
  assert.deepEqual(writes[0][2].students.map((s: any) => s.id), ['b', 'c', 'a']);
  assert.deepEqual(roster.students.map(s => s.id), ['c', 'b', 'a']);
  for (const [code, message] of [['ROSTER_CHANGED', 'conflict'], ['ROSTER_ORDER_CHANGED', 'conflict'], ['ROSTER_DAY_CHANGED', 'dayChanged'], ['UNKNOWN', 'failed']]) {
    fail = new ConvexError({ code });
    const row = render().find(n => n.type === components.SortableStudent)!;
    row.props.onMove(1);
    await flush();
    assert.equal(render().find(n => n.props.role === 'alert')!.props.children, message);
    assert.equal(render().find(n => n.type === 'ul')!.props['aria-busy'], false, 'Failure unlocks interaction; Convex rolls back its optimistic cache');
  }
  state.length = 0;
  cursor = 0;
  let moved = 0;
  const row = components.SortableStudent({ student: roster.students[0], first: true, last: false, disabled: false, renderStudent: props.renderStudent, onMove: (offset: number) => { moved = offset; } });
  const popover = row.props.children;
  const handle = popover.props.children[0].props.children;
  assert.match(handle.props.className, /touch-manipulation/);
  assert.match(handle.props.className, /size-11/);
  const buttons = popover.props.children[1].props.children.props.children;
  assert.equal(buttons[0].props.disabled, true);
  assert.equal(buttons[1].props.disabled, false);
  buttons[1].props.onClick();
  assert.equal(moved, 1);
  state.length = 0;
  fail = null;
  roster.students = ['a', 'b', 'c'].map(id => ({ id, name: id }));
  Object.assign(props, { students: [roster.students[1], roster.students[2], roster.students[0]] });
  context().onDragStart({ active: { id: 'b' } });
  context().onDragEnd({ active: { id: 'b' }, over: { id: 'c' } });
  await flush();
  assert.deepEqual(Array.from(calls.at(-1).studentIds), ['a', 'c', 'b'], 'Manual drag changes the saved route without persisting automatic rotation');
});
