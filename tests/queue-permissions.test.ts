import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addCar, removeCar, moveCar, clearAllCars } from '../convex/queue';
import type { MutationCtx } from '../convex/_generated/server';
import type { Doc, Id } from '../convex/_generated/dataModel';

// Run with: node --import tsx --test tests/queue-permissions.test.ts
// Execute real handlers, stopping at the first queue access: no backend or writes.
const reachedQueue = new Error('Authorization passed');
const queueId = 'test-queue' as Id<'dismissalQueue'>;
function invoke(mutation: object, ctx: MutationCtx, args: Record<string, unknown>) {
    // Convex exposes this test entry point at runtime, but omits it from public types.
    const handler = Reflect.get(mutation, '_handler') as (ctx: MutationCtx, args: Record<string, unknown>) => Promise<unknown>;
    assert.equal(typeof handler, 'function');
    return handler(ctx, args);
}
const actions = [
    { name: 'add', roles: ['allocator', 'operator', 'admin', 'superadmin'], run: (ctx: MutationCtx) => invoke(addCar, ctx, { carNumber: 11, campus: 'test', lane: 'left' }) },
    { name: 'move', roles: ['allocator', 'operator', 'admin', 'superadmin'], run: (ctx: MutationCtx) => invoke(moveCar, ctx, { queueId, newLane: 'right' }) },
    { name: 'remove', roles: ['dispatcher', 'operator', 'admin', 'superadmin'], run: (ctx: MutationCtx) => invoke(removeCar, ctx, { queueId }) },
    { name: 'clear', roles: ['dispatcher', 'operator', 'admin', 'superadmin'], run: (ctx: MutationCtx) => invoke(clearAllCars, ctx, { campus: 'test' }) },
];

function context(user: Partial<Doc<'users'>> | null, authenticated = true): MutationCtx {
    return {
        auth: {
            // An elevated token claim must not override a revoked database role.
            getUserIdentity: async () => authenticated ? { subject: 'clerk-test', issuer: 'test', tokenIdentifier: 'test|clerk-test', role: 'superadmin' } : null,
        },
        db: {
            query(table: string) {
                if (table !== 'users') throw reachedQueue;
                return {
                    withIndex(_name: string, select: (q: unknown) => void) {
                        select({ eq(field: string, value: string) {
                            assert.equal(field, 'clerkId');
                            assert.equal(value, 'clerk-test');
                        } });
                        return { first: async () => user };
                    },
                };
            },
            get() { throw reachedQueue; },
            insert() { assert.fail('Authorization must not create users or write queue data'); },
        },
    } as unknown as MutationCtx;
}

test('Every public queue mutation enforces its role before touching queue data', async () => {
    for (const action of actions) {
        for (const role of ['viewer', 'allocator', 'dispatcher', 'operator', 'admin', 'superadmin', undefined] as const) {
            const allowed = action.roles.includes(role ?? 'viewer');
            await assert.rejects(
                async () => action.run(context({ role, isActive: true })),
                (error: unknown) => allowed ? error === reachedQueue : error instanceof Error && /Not authorized/.test(error.message),
                `${action.name}: ${role ?? 'missing role'}`,
            );
        }
    }
});

test('Unauthenticated, missing and inactive users cannot mutate the queue', async () => {
    for (const action of actions) {
        await assert.rejects(async () => action.run(context(null, false)), /Not authenticated/);
        for (const user of [null, { role: 'operator', isActive: false }, { role: 'admin', isActive: true, status: 'inactive' }] as const) {
            await assert.rejects(async () => action.run(context(user)), /User not active/);
        }
    }
});
