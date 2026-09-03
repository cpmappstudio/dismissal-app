import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removeCar, moveCar } from '../convex/queue';
import { deleteStudent, deleteMultipleStudents } from '../convex/students';

// Run with: node --import tsx --test tests/queue-identity.test.ts
// Real mutation handlers, in-memory data only; this does not simulate Convex concurrency.
type Row = Record<string, unknown>;
const operations = [
    { name: 'dispatch', mutation: removeCar, args: { queueId: 'A' }, moved: false },
    { name: 'move to occupied lane', mutation: moveCar, args: { queueId: 'A', newLane: 'right' }, moved: true },
    { name: 'move to empty lane', mutation: moveCar, args: { queueId: 'A', newLane: 'right' }, moved: true },
    { name: 'delete last student', mutation: deleteStudent, args: { studentId: 'student-A' }, moved: false },
    { name: 'bulk delete last student', mutation: deleteMultipleStudents, args: { studentIds: ['student-A'] }, moved: false },
];

test('Reordering and moving preserve IDs, metadata, lane order and subsequent dispatch', async () => {
    for (const operation of operations) {
        const student = { _id: 'student-A', fullName: 'Student A', carNumber: 1, campuses: ['campus-id'], isActive: true };
        const car = (id: string, position: number, lane = 'left', campusLocation = 'campus'): Row => ({
            _id: id, _creationTime: 100, carNumber: id.charCodeAt(0) - 64,
            campusLocation, lane, position, assignedTime: 200, addedBy: 'user',
            status: 'waiting', carColor: '#123456',
            students: [{ studentId: `student-${id}`, name: `Student ${id}`, grade: '5' }],
        });
        const initial = [car('P', 1), car('A', 2), car('B', 3), car('C', 4), car('Z', 3, 'left', 'other')];
        if (operation.name !== 'move to empty lane') initial.push(car('R', 1, 'right'));
        const queue = new Map(initial.map(row => [String(row._id), row]));
        const tables = {
            dismissalQueue: queue,
            students: new Map([['student-A', student]]),
            users: new Map([['user', { _id: 'user', clerkId: 'clerk', role: 'principal', assignedCampuses: ['campus-id'], isActive: true }]]),
            campusSettings: new Map([['campus-id', { _id: 'campus-id', campusName: 'campus' }]]),
            dismissalHistory: new Map<string, Row>(),
        };
        const ctx = {
            auth: { getUserIdentity: async () => ({ subject: 'clerk' }) },
            db: {
                query(table: keyof typeof tables) {
                    let rows: Row[] = [...tables[table].values()];
                    const index = { eq(field: string, value: unknown) { rows = rows.filter(row => row[field] === value); return index; } };
                    const query = {
                        withIndex(_name: string, select: (q: typeof index) => unknown) { select(index); return query; },
                        filter(select: (q: { field: (key: string) => unknown; eq: (a: unknown, b: unknown) => boolean; gt: (a: unknown, b: unknown) => boolean }) => boolean) {
                            rows = rows.filter(row => select({ field: key => row[key], eq: (a, b) => a === b, gt: (a, b) => Number(a) > Number(b) }));
                            return query;
                        },
                        collect: async () => rows,
                        first: async () => rows[0] ?? null,
                        unique: async () => rows[0] ?? null,
                    };
                    return query;
                },
                get: async (id: string) => queue.get(id) ?? tables.students.get(id) ?? tables.campusSettings.get(id) ?? null,
                patch: async (id: string, fields: Row) => {
                    assert.ok(queue.has(id), `Cannot patch missing vehicle ${id}`);
                    queue.set(id, { ...queue.get(id), ...fields });
                },
                delete: async (id: string) => { queue.delete(id); tables.students.delete(id); },
                insert: async (table: string, row: Row) => {
                    assert.equal(table, 'dismissalHistory', 'Reordering must not recreate vehicles');
                    const id = `history-${tables.dismissalHistory.size}`;
                    tables.dismissalHistory.set(id, row);
                    return id;
                },
            },
        };
        const invoke = (mutation: object, args: Row) =>
            (Reflect.get(mutation, '_handler') as (ctx: object, args: Row) => Promise<unknown>)(ctx, args);

        const result = await invoke(operation.mutation, operation.args);
        for (const original of initial) {
            const id = String(original._id);
            if (id === 'A') continue;
            assert.deepEqual(queue.get(id), {
                ...original,
                position: id === 'B' || id === 'C' ? Number(original.position) - 1 : original.position,
            }, `${operation.name}: only trailing positions in the same campus/lane may change`);
        }
        if (operation.moved) {
            assert.equal(result, 'A', 'moveCar must return the original ID');
            assert.deepEqual(queue.get('A'), { ...initial[1], lane: 'right', position: queue.has('R') ? 2 : 1 });
            assert.equal(tables.dismissalHistory.size, 0, 'Moving is not dispatching');
        } else {
            assert.equal(queue.has('A'), false);
            assert.equal(tables.dismissalHistory.size, 1);
            assert.equal(tables.dismissalHistory.get('history-0')?.carNumber, 1);
        }
        // B's ID was captured before the other operation, as in another session.
        await invoke(removeCar, { queueId: 'B' });
        assert.equal(queue.has('B'), false);
        assert.equal(queue.get('C')?.position, 2);
        assert.deepEqual(queue.get('P'), initial[0]);
        await assert.rejects(() => invoke(removeCar, { queueId: 'B' }), /Queue entry not found/);
    }
});
