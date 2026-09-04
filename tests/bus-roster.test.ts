import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import * as React from 'react';
import ts from 'typescript';

test('bus status colors and right-side toggles preserve boarding, reason, undo and readonly rules', async () => {
    const file = '../components/dismissal/bus-roster.tsx';
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    const declarations = source.statements.filter(node => ts.isFunctionDeclaration(node) || ts.isVariableStatement(node));
    const { outputText } = ts.transpileModule(`${declarations.map(node => node.getText(source).replace(/^export /, '')).join('\n')}; ({ BusRoster, BoardingControls });`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    });
    const state: unknown[] = [];
    let cursor = 0;
    let fail = false;
    const mutations: Record<string, unknown>[] = [];
    const roster = {
        inQueue: true, canEdit: true,
        students: ['pending', 'boarded', 'not_traveling', 'picked_up_early', 'departed'].map((status, index) => ({
            id: String(index), name: `Student ${index}`, grade: '4th',
            state: { status, revision: 1, updatedAt: 1788512400000 },
        })),
    };
    const components = runInNewContext(outputText, {
        React,
        useState: (initial: unknown) => {
            const index = cursor++;
            if (!(index in state)) state[index] = initial;
            return [state[index], (value: unknown) => { state[index] = value; }];
        },
        useTranslations: () => (key: string) => key,
        useOperationalDate: () => '2026-09-04',
        useQuery: () => roster,
        useMutation: () => async (args: Record<string, unknown>) => {
            if (fail) throw new Error('Conflict');
            mutations.push(args);
        },
        api: { studentDismissals: { getRoster: 'query', setStatus: 'mutation' } },
        ...Object.fromEntries(['Button', 'Input', 'Avatar', 'AvatarImage', 'AvatarFallback', 'ToggleGroup', 'Toggle', 'Check', 'Clock', 'LogOut', 'UserCheck', 'Users', 'UserX'].map(key => [key, key])),
    });
    type Element = React.ReactElement<Record<string, unknown>>;
    const props = { campus: 'School', date: '2026-09-04', studentId: 'sofia', state: null as null | { status: string; revision: number }, inQueue: false };
    const render = (controls = true) => {
        cursor = 0;
        const elements: Element[] = [];
        function visit(node: React.ReactNode) {
            React.Children.forEach(node, child => {
                if (!React.isValidElement<Record<string, unknown>>(child)) return;
                elements.push(child);
                visit(child.props.children as React.ReactNode);
            });
        }
        visit(controls ? components.BoardingControls(props) : components.BusRoster({ campus: 'School', carNumber: 123, timezone: 'UTC' }));
        return elements;
    };
    const group = () => render().find(node => node.type === 'ToggleGroup')!.props;
    const change = async (values: string[]) => {
        (group().onValueChange as (values: string[]) => void)(values);
        await new Promise(resolve => setImmediate(resolve));
    };
    assert.equal(group().multiple, false);
    assert.match(String(group().className), /col-start-2 row-start-1/);
    assert.equal(render().find(node => node.props.value === 'boarded')!.props.disabled, true);
    await change(['boarded']);
    assert.equal(mutations.length, 0, 'Cannot board before arrival');
    await change(['not_traveling']);
    const input = render().find(node => node.type === 'Input')!;
    assert.equal(input.props.required, true);
    const submit = async () => {
        (render().find(node => node.type === 'form')!.props.onSubmit as (event: object) => void)({ preventDefault() {} });
        await new Promise(resolve => setImmediate(resolve));
    };
    await submit();
    assert.equal(mutations.length, 0, 'No mutation without a reason');
    (input.props.onChange as (event: object) => void)({ target: { value: 'Absent' } });
    fail = true;
    await submit();
    assert.equal(render().some(node => node.props.role === 'alert'), true);
    assert.equal(render().some(node => node.type === 'form'), true);
    fail = false;
    await submit();
    assert.equal(mutations[0].status, 'not_traveling');
    assert.equal(mutations[0].reason, 'Absent');
    assert.equal(mutations[0].expectedRevision, 0);
    props.state = { status: 'not_traveling', revision: 1 };
    await change([]);
    assert.equal(mutations[1].status, 'pending');
    props.inQueue = true;
    props.state = { status: 'pending', revision: 2 };
    await change(['boarded']);
    assert.equal(mutations[2].status, 'boarded');
    props.state = { status: 'boarded', revision: 3 };
    props.inQueue = false;
    assert.equal(render().find(node => node.props.value === 'boarded')!.props.disabled, false, 'Undo remains available after manual queue clear');
    await change([]);
    assert.equal(mutations[3].status, 'pending');
    for (const status of ['picked_up_early', 'departed']) {
        props.state = { status, revision: 4 };
        assert.equal(render().length, 0);
    }
    const cards = render(false).filter(node => node.type === 'li');
    for (const [index, color] of ['slate', 'emerald', 'amber', 'sky', 'violet'].entries()) {
        assert.match(String(cards[index].props.className), new RegExp(`bg-${color}-50`));
        assert.match(String(cards[index].props.className), new RegExp(`border-${color}-`));
    }
    const labels = render(false).filter(node => typeof node.props.children === 'string' && node.props.children.startsWith('status.'));
    assert.equal(labels.length, 5);
    assert.equal(labels.every(node => node.props.className === 'sr-only'), true, 'State text is accessible without visible redundancy');
    const boardingCounter = () => render(false).find(node => node.props['aria-label'] === 'boardingProgress')!;
    const counterText = () => React.Children.toArray(boardingCounter().props.children as React.ReactNode).join('');
    assert.equal(counterText(), 'students (1/2)', 'Early pickups, not traveling and departed students are not expected');
    assert.equal(boardingCounter().type, 'h3');
    assert.equal(boardingCounter().props.className, 'text-lg font-semibold');
    assert.equal(boardingCounter().props['aria-live'], 'polite');
    assert.equal(render(false).some(node => node.type === 'h2'), false, 'No repeated bus/date header');
    roster.students[0].state.status = 'boarded';
    assert.equal(counterText(), 'students (2/2)', 'Boarding increases the numerator without changing the total');
    roster.students.push({ id: 'new', name: 'New student', grade: '4th', state: null! });
    assert.equal(counterText(), 'students (2/3)', 'A student without a daily state is expected');
    roster.students[3].state.status = 'pending';
    assert.equal(counterText(), 'students (2/4)', 'Correcting an early pickup restores the student to the total');
    roster.students[3].state.status = 'picked_up_early';
    assert.equal(counterText(), 'students (2/3)', 'Recording an early pickup reduces the total');
    roster.students[0].state.status = 'pending';
    assert.equal(counterText(), 'students (1/3)', 'Undoing boarding reduces only the numerator');
    roster.canEdit = false;
    assert.equal(render(false).some(node => node.type === components.BoardingControls), false);
    roster.students.splice(0);
    assert.equal(counterText(), 'students (0/0)', 'Empty rosters remain well defined');
});
