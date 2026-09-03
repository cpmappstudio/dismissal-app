import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessOperators, canAllocate, canDispatch, type DismissalRole } from './role-utils';

// Run with: node --import tsx --test lib/role-utils.test.ts
const roles: [DismissalRole | null, boolean, boolean][] = [
    ['operator', true, true],
    ['allocator', true, false],
    ['dispatcher', false, true],
    ['admin', true, true],
    ['principal', true, true],
    ['superadmin', true, true],
    ['viewer', false, false],
    [null, false, false],
];

for (const [role, allocate, dispatch] of roles) {
    test(`${role ?? 'unauthenticated'}: shared road access and capabilities`, () => {
        assert.equal(canAllocate(role), allocate);
        assert.equal(canDispatch(role), dispatch);
        assert.equal(canAccessOperators(role), allocate || dispatch);
    });
}
