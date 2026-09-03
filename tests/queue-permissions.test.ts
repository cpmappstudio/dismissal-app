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
    { name: 'add', roles: ['allocator', 'operator', 'principal', 'admin', 'superadmin'], run: (ctx: MutationCtx) => invoke(addCar, ctx, { carNumber: 11, campus: 'test', lane: 'left' }) },
    { name: 'move', roles: ['dispatcher', 'operator', 'principal', 'admin', 'superadmin'], run: (ctx: MutationCtx) => invoke(moveCar, ctx, { queueId, newLane: 'right' }) },
    { name: 'remove', roles: ['dispatcher', 'operator', 'principal', 'admin', 'superadmin'], run: (ctx: MutationCtx) => invoke(removeCar, ctx, { queueId }) },
    { name: 'clear', roles: ['dispatcher', 'operator', 'principal', 'admin', 'superadmin'], run: (ctx: MutationCtx) => invoke(clearAllCars, ctx, { campus: 'test' }) },
];

const campusId = 'campus-test' as Id<'campusSettings'>;
function context(user: Partial<Doc<'users'>> | null, authenticated = true, campusAccess = true): MutationCtx {
    return {
        auth: {
            // An elevated token claim must not override a revoked database role.
            getUserIdentity: async () => authenticated ? { subject: 'clerk-test', issuer: 'test', tokenIdentifier: 'test|clerk-test', role: 'superadmin' } : null,
        },
        db: {
            query(table: string) {
                if (table === 'campusSettings') return {
                    withIndex: () => ({ unique: async () => ({ _id: campusId }) }),
                };
                if (table !== 'users') throw reachedQueue;
                return {
                    withIndex(_name: string, select: (q: unknown) => void) {
                        select({ eq(field: string, value: string) {
                            assert.equal(field, 'clerkId');
                            assert.equal(value, 'clerk-test');
                        } });
                        return { first: async () => user && { ...user, assignedCampuses: campusAccess ? [campusId] : [] } };
                    },
                };
            },
            get() {
                if (!campusAccess) return { campusLocation: 'test' };
                throw reachedQueue;
            },
            insert() { assert.fail('Authorization must not create users or write queue data'); },
        },
    } as unknown as MutationCtx;
}

test('Every public queue mutation enforces its role before touching queue data', async () => {
    for (const action of actions) {
        for (const role of ['viewer', 'allocator', 'dispatcher', 'operator', 'principal', 'admin', 'superadmin', undefined] as const) {
            const allowed = action.roles.includes(role ?? 'viewer');
            await assert.rejects(
                async () => action.run(context({ role, isActive: true })),
                (error: unknown) => allowed ? error === reachedQueue : error instanceof Error && /Not authorized/.test(error.message),
                `${action.name}: ${role ?? 'missing role'}`,
            );
        }
    }
});

test('Queue mutations preserve campus restrictions for non-global roles', async () => {
    for (const action of actions) {
        for (const role of action.roles.filter(role => role !== 'superadmin')) {
            await assert.rejects(
                () => action.run(context({ role: role as Doc<'users'>['role'], isActive: true }, true, false)),
                /No access to campus/,
                `${action.name}: ${role}`,
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
