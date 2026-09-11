import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { ConvexError } from 'convex/values';
import ts from 'typescript';
import { canCrudStaffRole, getCrudStaffRoles } from '../lib/role-utils';

test('management can edit allocators and repair missing roles using the database profile, not stale Clerk metadata', () => {
    const file = '../components/dashboard/staff-table/staff-form-dialog.tsx';
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    const names = ['actorRole', 'normalizeRole', 'targetRole', 'canEditTarget'];
    const declarations = new Map<string, ts.VariableDeclaration>();
    function visit(node: ts.Node) {
        if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(source))) declarations.set(node.name.getText(source), node);
        ts.forEachChild(node, visit);
    }
    visit(source);
    const { outputText } = ts.transpileModule(names.map(name => `const ${declarations.get(name)!.getText(source)};`).join('\n') + '\ncanEditTarget;', {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    });
    for (const role of ['principal', 'admin', 'superadmin'] as const) {
        for (const target of ['allocator', '']) {
            const bindings = { mode: 'edit', staff: { role: target }, profile: { role, isActive: true },
                user: { publicMetadata: { role: 'viewer' } }, canCrudStaffRole,
                React: { useCallback: (fn: unknown) => fn } };
            assert.equal(runInNewContext(outputText, bindings), true);
            assert.equal(runInNewContext(outputText, { ...bindings, profile: { role, isActive: false } }), false);
        }
        assert.ok(getCrudStaffRoles(role).includes('allocator'));
    }
});

test('staff and driver lists wait for Convex authentication before querying', () => {
    const file = '../components/dashboard/staff-table/staff-table.tsx';
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    let initializer: ts.Expression | undefined;
    function visit(node: ts.Node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'usersData') initializer = node.initializer;
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(initializer);
    for (const isAuthenticated of [false, true]) {
        for (const driversOnly of [false, true]) {
            const args = runInNewContext(initializer.getText(source), {
                isAuthenticated, driversOnly,
                api: { users: { listUsers: 'listUsers' } },
                useQuery: (name: string, args: unknown) => {
                    assert.equal(name, 'listUsers');
                    return args;
                },
            });
            assert.equal(JSON.stringify(args), JSON.stringify(
                isAuthenticated ? (driversOnly ? { role: 'bus_driver' } : {}) : 'skip',
            ));
        }
    }
});

// Run the real submit callback with controlled Clerk responses, like the road tests.
test('driver form waits for creation and preserves the dialog on Clerk errors', async () => {
    const file = '../components/dashboard/staff-table/staff-form-dialog.tsx';
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    let declaration: ts.VariableDeclaration | undefined;
    function visit(node: ts.Node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleSubmit') declaration = node;
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(declaration);
    const { outputText } = ts.transpileModule(`const ${declaration.getText(source)}; handleSubmit;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    });
    const request = Promise.withResolvers<void>();
    let open = true;
    let busy = false;
    let error: string | null = null;
    let password = 'test-only-password';
    const bindings = {
        canSubmitForm: true, isSubmitting: false, isDriver: true, driversOnly: true, mode: 'create',
        buses: [{ identifier: 11 }],
        formData: { firstName: 'Bus', lastName: 'Driver', username: 'driver_11', email: '',
            role: 'bus_driver', busNumber: '11', assignedCampuses: ['School'], status: 'active' },
        avatarFile: null, currentAvatarStorageId: null, password, ConvexError,
        normalizeVehicleIdentifier: Number,
        setIsSubmitting: (value: boolean) => { busy = value; },
        setSubmitError: (value: string | null) => { error = value; },
        setPassword: (value: string) => { password = value; },
        setOpen: (value: boolean) => { open = value; },
        bt: () => 'Save failed',
        onSubmit: (payload: { role: string; username: string; password?: string }, credential: string) => {
            assert.equal(payload.role, 'bus_driver');
            assert.equal(payload.username, 'driver_11');
            assert.equal(payload.password, undefined);
            assert.equal(credential, 'test-only-password');
            return request.promise;
        },
    };
    const submit = runInNewContext(outputText, bindings) as (event: { preventDefault(): void }) => Promise<void>;
    const pending = submit({ preventDefault() {} });
    assert.equal(busy, true);
    assert.equal(open, true);
    request.reject(new ConvexError('That username is taken.'));
    await pending;
    assert.equal(open, true);
    assert.equal(busy, false);
    assert.equal(error, 'That username is taken.');
    assert.equal(password, 'test-only-password');

    const success = runInNewContext(outputText, { ...bindings, onSubmit: async () => {} }) as typeof submit;
    await success({ preventDefault() {} });
    assert.equal(open, false);
    assert.equal(password, '');
});
