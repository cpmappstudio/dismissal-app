import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import * as React from 'react';
import ts from 'typescript';
import { nextOperationalDay, operationalDate } from '../lib/operational-day';

test('operational date hook rolls over at the shared cutoff and refreshes after a suspended tab', () => {
    const file = '../hooks/use-operational-date.ts';
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    const hook = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'useOperationalDate');
    assert.ok(hook);
    const { outputText } = ts.transpileModule(`${hook.getText(source).replace(/^export /, '')}; useOperationalDate;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    });
    const cutoff = Date.parse('2026-09-04T05:00:00Z');
    let now = cutoff - 1;
    let state = now;
    let cleanup: (() => void) | undefined;
    let timer: (() => void) | undefined;
    let delay = 0;
    let focus: (() => void) | undefined;
    const render = runInNewContext(outputText, {
        operationalDate, nextOperationalDay,
        Date: { now: () => now },
        useState: () => [state, (value: number) => { state = value; }],
        useEffect: (effect: () => () => void) => { cleanup ??= effect(); },
        setTimeout: (callback: () => void, ms: number) => { timer = callback; delay = ms; return 1; },
        clearTimeout: () => { timer = undefined; },
        window: {
            addEventListener: (_event: string, callback: () => void) => { focus = callback; },
            removeEventListener: () => { focus = undefined; },
        },
    });
    assert.equal(render(), '2026-09-03');
    assert.equal(delay, 1);
    now = cutoff;
    timer!();
    assert.equal(render(), '2026-09-04');
    assert.equal(delay, 86_400_000);
    now = Date.parse('2026-09-05T12:00:00Z');
    focus!();
    assert.equal(render(), '2026-09-05');
    assert.equal(delay, nextOperationalDay(now) - now);
    cleanup!();
    assert.equal(timer, undefined);
    assert.equal(focus, undefined);
});

// Exercise the real sheet's controlled state and callbacks; Base UI owns keyboard navigation.
test('pickup combobox selects without submitting, preserves revisions and clears stale selection on typing', async () => {
    const file = '../components/dismissal/early-pickups.tsx';
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'PickupList');
    assert.ok(component);
    const { outputText } = ts.transpileModule(`${component.getText(source)}; PickupList;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    });
    const students = [
        { id: 'sofia', name: 'Sofia', grade: '5th', carNumber: 20, busNumber: 123, state: { status: 'pending', revision: 3 } },
        { id: 'ana', name: 'Ana', grade: '5th', carNumber: 0, busNumber: 123, state: { status: 'picked_up_early', revision: 1 } },
        { id: 'carlos', name: 'Carlos', grade: '5th', carNumber: 123, state: { status: 'departed', revision: 1 } },
        { id: 'luis', name: 'Luis', grade: '5th', carNumber: 20, busNumber: 123, state: { status: 'boarded', revision: 1 } },
    ];
    const state: unknown[] = [];
    let cursor = 0;
    const mutations: unknown[] = [];
    const renderComponent = runInNewContext(outputText, {
        React,
        useState: (initial: unknown) => {
            const index = cursor++;
            if (!(index in state)) state[index] = initial;
            return [state[index], (value: unknown) => { state[index] = value; }];
        },
        useRef: () => ({ current: null }),
        useTranslations: () => (key: string) => key,
        useOperationalDate: () => '2026-09-04',
        useQuery: () => ({ students, records: [] }),
        useMutation: () => async (args: unknown) => { mutations.push(args); },
        api: { studentDismissals: { searchPickupStudents: 'query', setStatus: 'mutation' } },
        Combobox: Object.fromEntries(['Root', 'InputGroup', 'Input', 'Trigger', 'Portal', 'Positioner', 'Popup', 'Empty', 'List', 'Item'].map(key => [key, `Combobox${key}`])),
        Input: 'Input', Button: 'Button', Label: 'Label', ChevronsUpDown: 'Icon', RecordedDepartures: 'RecordedDepartures',
    });
    type Element = React.ReactElement<Record<string, unknown>>;
    const render = () => {
        cursor = 0;
        const elements: Element[] = [];
        function visit(node: React.ReactNode) {
            React.Children.forEach(node, child => {
                if (!React.isValidElement<Record<string, unknown>>(child)) return;
                elements.push(child);
                visit(child.props.children as React.ReactNode);
            });
        }
        visit(renderComponent({ campus: 'School', timezone: 'UTC' }));
        return elements;
    };
    const root = () => render().find(node => node.type === 'ComboboxRoot')!.props;
    assert.equal(render().filter(node => node.type === 'RecordedDepartures').length, 1, 'The search and the unified table share the same screen');
    assert.equal(root().filter, null, 'Convex results must not be filtered again on the client');
    const items = render().filter(node => node.type === 'ComboboxItem');
    assert.deepEqual(items.map(node => node.props.disabled), [false, true, true, true]);
    function text(node: React.ReactNode): string {
        return React.Children.toArray(node).map(child => React.isValidElement<{ children?: React.ReactNode }>(child) ? text(child.props.children) : String(child)).join('');
    }
    assert.match(text(items[0]), /car: 20 · bus: 123/);
    assert.match(text(items[1]), /bus: 123/);
    assert.doesNotMatch(text(items[1]), /car:/);
    (root().onValueChange as (id: string) => void)('sofia');
    assert.equal(root().value, 'sofia');
    assert.equal(mutations.length, 0, 'Choosing a student must not record a pickup');
    const form = render().find(node => node.type === 'form')!;
    await (form.props.onSubmit as (event: object) => Promise<void>)({ preventDefault() {} });
    assert.equal(JSON.stringify(mutations[0]), JSON.stringify({
        campus: 'School', date: '2026-09-04', studentId: 'sofia', expectedRevision: 3,
        status: 'picked_up_early', collectedBy: '', reason: '',
    }));
    assert.equal(root().value, null);
    assert.equal(root().inputValue, '');
    (root().onValueChange as (id: string) => void)('sofia');
    (root().onInputValueChange as (value: string, details: object) => void)('An', { reason: 'input-change' });
    assert.equal(root().value, null);
    assert.equal(root().inputValue, 'An');
    assert.equal(render().some(node => node.type === 'form'), false);
});
