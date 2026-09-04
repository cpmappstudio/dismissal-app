import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import * as React from 'react';
import ts from 'typescript';

test('icon correction opens a popover, requires alert confirmation and preserves failed corrections', async () => {
    const file = '../components/dismissal/recorded-departures.tsx';
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    const components = source.statements.filter(node => ts.isFunctionDeclaration(node));
    const { outputText } = ts.transpileModule(`${components.map(node => node.getText(source).replace(/^export /, '')).join('\n')}; ({ RecordedDepartures, DepartureCorrection });`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    });
    let date = '2026-09-04';
    let fail = false;
    const state: unknown[] = [];
    let cursor = 0;
    const mutations: unknown[] = [];
    const portalContainer = { current: null };
    const record = { _id: 'record', studentId: 'sofia', studentName: 'Sofia', date, revision: 4, updatedAt: 1788512400000, vehicleIdentifier: 123, status: 'departed', departureCampus: 'School', canCorrect: false };
    const renderComponents = runInNewContext(outputText, {
        React,
        useRef: () => portalContainer,
        useOperationalDate: () => date,
        useState: (initial: unknown) => {
            const index = cursor++;
            if (!(index in state)) state[index] = initial;
            return [state[index], (value: unknown) => { state[index] = value; }];
        },
        useTranslations: () => (key: string) => key,
        usePaginatedQuery: (_api: unknown, args: unknown) => {
            assert.equal(JSON.stringify(args), JSON.stringify({ campus: 'School', date }));
            return { results: [record], status: 'Exhausted', loadMore: () => {} };
        },
        useMutation: () => async (args: unknown) => {
            if (fail) throw new Error('Conflict');
            mutations.push(args);
        },
        api: { studentDismissals: { listRecordedDepartures: 'query', correctDeparture: 'mutation', setStatus: 'pickupMutation' } },
        Popover: Object.fromEntries(['Root', 'Trigger', 'Portal', 'Positioner', 'Popup', 'Title'].map(key => [key, `Popover${key}`])),
        AlertDialog: Object.fromEntries(['Root', 'Portal', 'Backdrop', 'Popup', 'Title', 'Description', 'Close'].map(key => [key, `Alert${key}`])),
        Pencil: 'Pencil',
        ...Object.fromEntries(['Table', 'TableHeader', 'TableRow', 'TableHead', 'TableBody', 'TableCell', 'Button', 'Input', 'Label'].map(key => [key, key])),
    });
    type Element = React.ReactElement<Record<string, unknown>>;
    const render = (correction = true) => {
        cursor = 0;
        const elements: Element[] = [];
        function visit(node: React.ReactNode) {
            React.Children.forEach(node, child => {
                if (!React.isValidElement<Record<string, unknown>>(child)) return;
                elements.push(child);
                visit(child.props.children as React.ReactNode);
            });
        }
        visit(correction
            ? renderComponents.DepartureCorrection({ record, campus: 'School', date, portalContainer })
            : renderComponents.RecordedDepartures({ campus: 'School', timezone: 'UTC' }));
        return elements;
    };
    assert.equal(render(false).some(node => node.type === renderComponents.DepartureCorrection), false);
    record.canCorrect = true;
    assert.equal(render(false).some(node => node.type === renderComponents.DepartureCorrection), true);
    assert.equal(render(false).some(node => node.type === 'form'), false, 'No correction form is added to the sheet layout');
    assert.equal(render(false).find(node => node.props.ref === portalContainer)?.type, 'div');
    assert.equal(render(false).find(node => node.type === renderComponents.DepartureCorrection)?.props.portalContainer, portalContainer);
    for (const type of ['PopoverPortal', 'AlertPortal'])
        assert.equal(render().find(node => node.type === type)?.props.container, portalContainer, 'Portal targets the outer container, never the table cell');
    assert.equal(render().find(node => node.type === 'PopoverPositioner')?.props.positionMethod, 'fixed');
    const popover = () => render().find(node => node.type === 'PopoverRoot')!.props;
    const alert = () => render().find(node => node.type === 'AlertRoot')!.props;
    const trigger = render().find(node => node.type === 'PopoverTrigger')!;
    assert.equal((trigger.props.render as Element).props.size, 'icon');
    assert.equal(trigger.props['aria-label'], 'correctDepartureFor');
    const select = () => (popover().onOpenChange as (open: boolean) => void)(true);
    select();
    assert.equal(popover().open, true);
    assert.equal(mutations.length, 0);
    const input = render().find(node => node.type === 'Input')!;
    assert.equal(input.props.required, true);
    (input.props.onChange as (event: object) => void)({ target: { value: 'Wrong student' } });
    const submit = () => (render().find(node => node.type === 'form')!.props.onSubmit as (event: object) => Promise<void>)({ preventDefault() {} });
    await submit();
    assert.equal(alert().open, true);
    assert.equal(mutations.length, 0, 'Submitting the reason only opens confirmation');
    (alert().onOpenChange as (open: boolean) => void)(false);
    assert.equal(alert().open, false);
    assert.equal(popover().open, true);
    assert.equal(mutations.length, 0, 'Cancel does not mutate');
    await submit();
    const confirm = () => (render().find(node => node.type === 'Button' && node.props.children === 'confirm')!.props.onClick as () => Promise<void>)();
    fail = true;
    await confirm();
    assert.equal(render().some(node => node.props.role === 'alert'), true);
    assert.equal(alert().open, true);
    fail = false;
    await confirm();
    assert.equal(JSON.stringify(mutations[0]), JSON.stringify({
        campus: 'School', date, departureId: 'record', expectedRevision: 4, reason: 'Wrong student',
    }));
    assert.equal(popover().open, false);
    assert.equal(alert().open, false);
    record.status = 'picked_up_early';
    select();
    (render().find(node => node.type === 'Input')!.props.onChange as (event: object) => void)({ target: { value: 'Wrong pickup' } });
    await submit();
    assert.equal(mutations.length, 1);
    await confirm();
    assert.equal(JSON.stringify(mutations[1]), JSON.stringify({
        campus: 'School', date, studentId: 'sofia', status: 'pending', expectedRevision: 4, reason: 'Wrong pickup',
    }));
    select();
    date = '2026-09-05';
    assert.equal(popover().open, false, 'Yesterday\'s correction must not carry into today');
    assert.equal(alert().open, false);
});
