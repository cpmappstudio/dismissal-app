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
    const rosterState: unknown[] = [];
    let currentState = state;
    let queriedDate = '';
    let cursor = 0;
    let fail = false;
    let showDate = false;
    let operationalDate = '2026-09-04';
    const recordedDates = ['2026-08-27', '2026-09-01'];
    const mutations: Record<string, unknown>[] = [];
    const roster = {
        canEdit: true,
        students: ['pending', 'boarded', 'not_traveling', 'picked_up_early', 'departed'].map((status, index) => ({
            id: String(index), name: `Student ${index}`, grade: '4th',
            state: { status, revision: 1, updatedAt: 1788512400000,
                boarding: undefined as undefined | { at: number; byName: string },
                dropoff: undefined as undefined | { at: number; byName: string },
            },
        })),
    };
    const components = runInNewContext(outputText, {
        React,
        useState: (initial: unknown) => {
            const values = currentState;
            const index = cursor++;
            if (!(index in values)) values[index] = initial;
            return [values[index], (value: unknown) => { values[index] = value; }];
        },
        useTranslations: () => (key: string) => key,
        useOperationalDate: () => operationalDate,
        useQuery: (_name: string, args: { date: string; historical: boolean }) => {
            queriedDate = args.date;
            assert.equal(args.historical, args.date !== operationalDate, 'Live and historical subscriptions have distinct keys');
            return { ...roster,
                previousDate: recordedDates.filter(d => d < args.date).at(-1) ?? null,
                nextDate: recordedDates.find(d => d > args.date && d <= operationalDate) ?? null,
            };
        },
        useMutation: () => async (args: Record<string, unknown>) => {
            if (fail) throw new Error('Conflict');
            mutations.push(args);
        },
        api: { studentDismissals: { getRoster: 'query', setStatus: 'mutation', setDropoff: 'dropoff' } },
        ...Object.fromEntries(['Button', 'Input', 'Avatar', 'AvatarImage', 'AvatarFallback', 'ToggleGroup', 'Toggle', 'Check', 'ChevronLeft', 'ChevronRight', 'Clock', 'LogOut', 'UserCheck', 'Users', 'UserX'].map(key => [key, key])),
    });
    type Element = React.ReactElement<Record<string, unknown>>;
    const props = { campus: 'School', date: '2026-09-04', studentId: 'sofia', state: null as null | { status: string; revision: number; vehicleType?: string; dropoff?: object } };
    const render = (controls = true) => {
        cursor = 0;
        currentState = controls ? state : rosterState;
        const elements: Element[] = [];
        function visit(node: React.ReactNode) {
            React.Children.forEach(node, child => {
                if (!React.isValidElement<Record<string, unknown>>(child)) return;
                elements.push(child);
                visit(child.props.children as React.ReactNode);
            });
        }
        visit(controls ? components.BoardingControls(props) : components.BusRoster({ campus: 'School', carNumber: 123, timezone: 'UTC', showDate }));
        return elements;
    };
    const group = () => render().find(node => node.type === 'ToggleGroup')!.props;
    const change = async (values: string[]) => {
        (group().onValueChange as (values: string[]) => void)(values);
        await new Promise(resolve => setImmediate(resolve));
    };
    assert.equal(group().multiple, false);
    assert.match(String(group().className), /col-start-2 row-start-1/);
    assert.equal(render().find(node => node.props.value === 'boarded')!.props.disabled, false);
    await change(['boarded']);
    assert.equal(mutations[0].status, 'boarded', 'Boarding works independently of Road');
    mutations.length = 0;
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
    props.state = { status: 'pending', revision: 2 };
    await change(['boarded']);
    assert.equal(mutations[2].status, 'boarded');
    props.state = { status: 'boarded', revision: 3 };
    assert.equal(render().find(node => node.props.value === 'boarded')!.props.disabled, false, 'Undo remains available after manual queue clear');
    await change([]);
    assert.equal(mutations[3].status, 'pending');
    const toggleValues = () => render().filter(node => node.type === 'Toggle').map(node => node.props.value);
    props.state = { status: 'pending', revision: 4 };
    assert.deepEqual(toggleValues(), ['boarded', 'not_traveling']);
    props.state = { status: 'boarded', revision: 5, vehicleType: 'bus' };
    assert.deepEqual(toggleValues(), ['dropoff', 'boarded'], 'Boarding moves right and drop-off replaces not-traveling');
    assert.match(String(render().find(node => node.props.value === 'boarded')!.props.className), /motion-safe:animate-slide-in-left/);
    await change(['boarded', 'dropoff']);
    assert.equal(mutations.at(-1)!.droppedOff, true);
    assert.equal(mutations.at(-1)!.expectedRevision, 5);
    props.state = { status: 'boarded', revision: 6, vehicleType: 'bus', dropoff: { at: 1 } };
    assert.equal(render().find(node => node.props.value === 'boarded')!.props.disabled, true, 'Undo drop-off before undoing boarding');
    const beforeInvalidUndo = mutations.length;
    await change([]);
    assert.equal(mutations.length, beforeInvalidUndo);
    await change(['boarded']);
    assert.equal(mutations.at(-1)!.droppedOff, false);
    props.state = { status: 'departed', revision: 7, vehicleType: 'bus' };
    assert.deepEqual(toggleValues(), ['dropoff', 'boarded'], 'Drop-off stays available after Road departure');
    await change(['boarded', 'dropoff']);
    assert.equal(mutations.at(-1)!.droppedOff, true);
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
    const detailCount = () => render(false).filter(node => String(node.props.className).startsWith('col-span-2 space-y-1')).length;
    assert.equal(detailCount(), 4, 'Pending records do not display attendance metadata');
    for (const status of ['boarded', 'not_traveling']) {
        roster.students[0].state.status = status;
        assert.equal(detailCount(), 5, 'Marked students display their record details');
        roster.students[0].state.status = 'pending';
        assert.equal(detailCount(), 4, 'Unmarking hides the record details without deleting its revision');
    }
    const boardingCounter = () => render(false).find(node => node.props['aria-label'] === 'boardingProgress')!;
    const counterText = () => React.Children.toArray(boardingCounter().props.children as React.ReactNode).join('');
    assert.equal(counterText(), 'students (2/3)', 'Road departure does not mean a student got off the bus');
    roster.students[1].state.boarding = { at: 1788512400000, byName: 'Driver boarding' };
    roster.students[1].state.dropoff = { at: 1788516000000, byName: 'Driver dropoff' };
    assert.equal(counterText(), 'students (1/3)', 'Drop-off reduces passengers on board without changing the expected total');
    assert.match(String(render(false).filter(node => node.type === 'li')[1].props.className), /bg-indigo-50/);
    const eventLines = render(false).filter(node => node.type === 'p').map(node => React.Children.toArray(node.props.children as React.ReactNode).filter(child => typeof child === 'string').join(''));
    assert.ok(eventLines.some(line => line.includes('Driver boarding')));
    assert.ok(eventLines.some(line => line.includes('Driver dropoff')), 'Both events are displayed');
    roster.students[1].state.dropoff = undefined;
    assert.equal(counterText(), 'students (2/3)', 'Undoing drop-off restores the passenger count');
    roster.students[1].state.boarding = undefined;
    assert.equal(boardingCounter().type, 'h3');
    assert.equal(boardingCounter().props.className, 'text-lg font-semibold');
    assert.equal(boardingCounter().props['aria-live'], 'polite');
    assert.equal(render(false).some(node => node.type === 'h2'), false, 'No repeated bus/date header');
    assert.equal(render(false).some(node => node.type === 'time'), false, 'Existing road drawers keep their compact header');
    showDate = true;
    const header = render(false).find(node => node.props.className === 'flex items-center justify-between gap-2')!;
    assert.ok(header, 'Counter and navigation share one non-wrapping row');
    assert.match(String(boardingCounter().props.className), /text-base.*sm:text-lg/);
    assert.match(String(render(false).find(node => node.props['aria-label'] === 'dateNavigation')!.props.className), /shrink-0.*whitespace-nowrap/);
    for (const date of ['2026-09-04', '2026-09-05']) {
        operationalDate = date;
        const time = render(false).find(node => node.type === 'time')!;
        assert.equal(time.props.dateTime, date);
        assert.equal(queriedDate, date);
        assert.equal(time.props.children, date, 'Displayed date follows the same daily rollover as the roster query');
        assert.equal(time.props.className, 'ml-1 text-xs text-muted-foreground');
    }
    roster.students[0].state.status = 'boarded';
    assert.equal(counterText(), 'students (3/3)', 'Boarding increases the numerator without changing the total');
    roster.students.push({ id: 'new', name: 'New student', grade: '4th', state: null! });
    assert.equal(counterText(), 'students (3/4)', 'A student without a daily state is expected');
    roster.students[3].state.status = 'pending';
    assert.equal(counterText(), 'students (3/5)', 'Correcting an early pickup restores the student to the total');
    roster.students[3].state.status = 'picked_up_early';
    assert.equal(counterText(), 'students (3/4)', 'Recording an early pickup reduces the total');
    roster.students[0].state.status = 'pending';
    assert.equal(counterText(), 'students (2/4)', 'Undoing boarding reduces only the numerator');
    const dateButton = (label: string) => render(false).find(node => node.props['aria-label'] === label)!.props;
    assert.equal(dateButton('nextDay').disabled, true);
    (dateButton('previousDay').onClick as () => void)();
    assert.equal(render(false).find(node => node.type === 'time')!.props.dateTime, '2026-09-01', 'Skip empty days');
    assert.equal(queriedDate, '2026-09-01');
    assert.equal(render(false).some(node => node.props.children === 'historicalRecords'), false, 'No redundant historical explanation');
    assert.equal(counterText(), 'students (2/4)', 'Past departures count as students who boarded');
    assert.equal(render(false).some(node => node.type === components.BoardingControls), false, 'Past days stay read-only even with a stale editable response');
    operationalDate = '2026-09-06';
    assert.equal(render(false).find(node => node.type === 'time')!.props.dateTime, '2026-09-01', 'Rollover preserves an explicitly selected past day');
    assert.equal(dateButton('nextDay').disabled, true, 'No next record, even if today is later');
    (dateButton('nextDay').onClick as () => void)();
    assert.equal(queriedDate, '2026-09-01');
    (dateButton('previousDay').onClick as () => void)();
    assert.equal(render(false).find(node => node.type === 'time')!.props.dateTime, '2026-08-27');
    assert.equal(dateButton('previousDay').disabled, true, 'Stop at earliest record');
    (dateButton('previousDay').onClick as () => void)();
    assert.equal(render(false).find(node => node.type === 'time')!.props.dateTime, '2026-08-27');
    (dateButton('nextDay').onClick as () => void)();
    assert.equal(render(false).find(node => node.type === 'time')!.props.dateTime, '2026-09-01');
    (render(false).find(node => node.props.children === 'today')!.props.onClick as () => void)();
    assert.equal(render(false).find(node => node.type === 'time')!.props.dateTime, operationalDate);
    assert.equal(dateButton('nextDay').disabled, true);
    operationalDate = '2026-09-07';
    assert.equal(render(false).find(node => node.type === 'time')!.props.dateTime, operationalDate, 'Today follows the shared daily reset');
    recordedDates.splice(0);
    assert.equal(dateButton('previousDay').disabled, true);
    assert.equal(dateButton('nextDay').disabled, true);
    roster.canEdit = false;
    assert.equal(render(false).some(node => node.type === components.BoardingControls), false);
    roster.students.splice(0);
    assert.equal(counterText(), 'students (0/0)', 'Empty rosters remain well defined');
});
