import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { RemoveCarHandler } from '../components/dismissal/types';

// Run with: node --import tsx --test tests/dismissal-removal.test.ts
// Execute the actual callbacks with controlled promises, without mounting Clerk/Convex.
function callback<T>(file: string, bindings: Record<string, unknown>): T {
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
    let declaration: ts.VariableDeclaration | undefined;
    function visit(node: ts.Node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleRemoveCar') declaration = node;
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(declaration, `${file}: removal callback must exist`);
    const { outputText } = ts.transpileModule(`const ${declaration.getText(source)}; handleRemoveCar;`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    });
    return runInNewContext(outputText, bindings) as T;
}

function harness(pendingAdd = false, allowDispatch = true) {
    const busy = { current: pendingAdd };
    let mutations = 0;
    let removing = new Set<string>();
    const alerts: string[] = [];
    const timers: (() => void)[] = [];
    const request = Promise.withResolvers<{ carNumber: number }>();
    const useCallback = (fn: unknown) => fn;
    const dispatch = callback<RemoveCarHandler>('../components/dismissal/dismissal-view.tsx', {
        React: { useCallback }, allowDispatch, isSubmittingRef: busy,
        updateIsSubmitting: (value: boolean) => { busy.current = value; },
        removeCarFromQueue: () => { mutations++; return request.promise; },
        showAlert: (type: string) => alerts.push(type),
    });
    const animate = callback<(id: string, handler: RemoveCarHandler) => boolean>('../components/dismissal/hooks.ts', {
        useCallback,
        setRemovingCars: (update: (previous: Set<string>) => Set<string>) => { removing = update(removing); },
        setTimeout: (resolve: () => void) => timers.push(resolve),
        ANIMATION_DURATIONS: { EXIT: 600 },
    });
    return {
        busy, request, alerts,
        click: () => animate('car-11', dispatch),
        finishAnimation: () => timers.forEach(resolve => resolve()),
        get mutations() { return mutations; },
        get removing() { return removing.has('car-11'); },
        get timerCount() { return timers.length; },
    };
}

test('Pending add rejects dispatch before mutation or animation, then allows a retry', async () => {
    const view = harness(true);
    assert.equal(view.click(), false);
    assert.equal(view.mutations, 0);
    assert.equal(view.removing, false);
    assert.equal(view.timerCount, 0);

    view.busy.current = false; // The add request completes.
    assert.equal(view.click(), true);
    assert.equal(view.mutations, 1);
    assert.equal(view.busy.current, true);
    assert.equal(view.removing, true);
    assert.equal(view.click(), false); // A rapid second click cannot bypass the lock.
    assert.equal(view.mutations, 1);

    view.finishAnimation();
    await setImmediate();
    assert.equal(view.removing, true); // A slow mutation must not make the car reappear.
    view.request.resolve({ carNumber: 11 });
    await setImmediate();
    assert.equal(view.busy.current, false);
    assert.equal(view.removing, false);
    assert.deepEqual(view.alerts, ['success']);
});

test('A fast dispatch retains the exit animation until its duration completes', async () => {
    const view = harness();
    assert.equal(view.click(), true);
    view.request.resolve({ carNumber: 11 });
    await setImmediate();
    assert.equal(view.busy.current, false);
    assert.equal(view.removing, true);
    view.finishAnimation();
    await setImmediate();
    assert.equal(view.removing, false);
});

test('Failed dispatch releases the lock and restores the car without waiting for animation', async () => {
    const view = harness();
    view.click();
    view.request.reject(new Error('Network failure'));
    await setImmediate();
    assert.equal(view.busy.current, false);
    assert.equal(view.removing, false);
    assert.deepEqual(view.alerts, ['error']);
});

test('No dispatch capability means no mutation and no animation', () => {
    const view = harness(false, false);
    assert.equal(view.click(), false);
    assert.equal(view.mutations, 0);
    assert.equal(view.removing, false);
});
