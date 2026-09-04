import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { canDispatch } from '@/lib/role-utils';
import messages from '@/messages/en.json';
import type { CarData, ModeType, RemoveCarHandler } from './types';
import { EarlyPickups } from './early-pickups';
import { BUS_COLORS, LANE_COLORS } from './constants';

// Run with: node --import tsx --test components/dismissal/lane.test.tsx
// These assertions inspect markup; Next.js handles the CSS in the actual app.
const requireComponent = createRequire(import.meta.url);
requireComponent.extensions['.css'] = () => {};
const { Lane } = requireComponent('./lane') as typeof import('./lane');
const { Road } = requireComponent('./road') as typeof import('./road');

// No storage IDs or live queries: this client only supplies context for avatar rendering.
const client = new ConvexReactClient('https://example.convex.cloud');

test('early pickups uses an accessible mobile icon button and keeps the desktop label', () => {
    const html = renderToStaticMarkup(
        <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
            <EarlyPickups campus="School" timezone="UTC" />
        </NextIntlClientProvider>,
    );
    assert.match(html, /<button[^>]*class="[^"]*size-9/);
    assert.ok(html.includes(`aria-label="${messages.transport.earlyPickups}"`));
    assert.ok(html.includes('md:w-auto md:px-4'));
    assert.ok(html.includes('border-2 border-yankees-blue hover:bg-yankees-blue/10'));
    assert.ok(html.includes('lucide-user-check'));
    assert.match(html, /<svg[^>]*md:hidden[^>]*aria-hidden="true"/);
    assert.ok(html.includes(`<span class="hidden md:inline">${messages.transport.earlyPickups}</span>`));
});
const car: CarData = {
    id: 'test-car', carNumber: 11, lane: 'left', position: 0,
    assignedTime: new Date('2026-09-03T15:00:00Z'),
    campus: 'test-campus', imageColor: '#A6A6A6',
    students: [{ id: 'test-student', name: 'Test Student', grade: '5' }],
};

function renderLane(mode: ModeType, onRemoveCar?: RemoveCarHandler, disableRemoval = false, vehicle = car) {
    return renderToStaticMarkup(
        <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
            <ConvexProvider client={client}>
                <Lane cars={[vehicle]} lane={vehicle.lane} mode={mode} onRemoveCar={onRemoveCar} disableRemoval={disableRemoval} />
            </ConvexProvider>
        </NextIntlClientProvider>
    );
}

for (const role of ['operator', 'allocator', 'dispatcher', 'principal', 'admin', 'superadmin', 'viewer', null] as const) {
    test(`${role ?? 'unauthenticated'}: dispatch control on the shared road`, () => {
        const canRemove = canDispatch(role);
        const html = renderLane('operator', canRemove ? async () => {} : undefined);
        assert.equal(html.includes('aria-label="Remove car 11"'), canRemove);
    });
}

test('Viewer stays read-only even if a dispatch callback is supplied', () => {
    const html = renderLane('viewer', async () => {});
    assert.ok(html.includes('Test Student'));
    assert.ok(!html.includes('aria-label="Remove car 11"'));
    assert.ok(!html.includes('hover:text-red-500'));
});

test('Dispatch button remains visible but disabled while another operation is pending', () => {
    const html = renderLane('operator', async () => {}, true);
    assert.match(html, /<button[^>]*aria-label="Remove car 11"[^>]*disabled=""/);
    const idle = renderLane('operator', async () => {});
    assert.doesNotMatch(idle, /<button[^>]*aria-label="Remove car 11"[^>]*disabled=""/);
});

for (const mode of ['operator', 'viewer'] as const) {
    for (const lane of ['left', 'right'] as const) {
        test(`${mode}, ${lane}: buses use yellow with dark text and cars retain lane colors`, () => {
            const bus = renderLane(mode, undefined, false, { ...car, lane, vehicleType: 'bus' });
            assert.ok(bus.includes(BUS_COLORS.badge));
            assert.ok(bus.includes('fill="var(--color-amber-400, #fbbf24)"'));
            assert.ok(!bus.includes(LANE_COLORS[lane].badge));
            assert.doesNotMatch(bus, /class="[^"]*text-white[^"]*"[^>]*>11</);
            if (mode === 'viewer') {
                assert.match(bus, /<span class="font-bold">Students \(1\)<\/span>/);
            }
            const normal = renderLane(mode, undefined, false, { ...car, lane });
            assert.ok(normal.includes(LANE_COLORS[lane].badge));
            assert.ok(!normal.includes(BUS_COLORS.badge));
        });
    }

    test(`${mode}: a bus uses its distinct drawing in the shared lane`, () => {
        assert.match(renderLane(mode, undefined, false, { ...car, vehicleType: 'bus' }), /aria-label="Bus"/);
        assert.doesNotMatch(renderLane(mode), /aria-label="Bus"/);
    });

    test(`${mode}: road uses available height and scrolls only on overflow`, () => {
        const html = renderToStaticMarkup(
            <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
                <Road leftLaneCars={[]} rightLaneCars={[]} mode={mode} />
            </NextIntlClientProvider>
        );
        assert.ok(html.includes('min-h-0'));
        assert.ok(html.includes('overflow-y-auto'));
        assert.ok(!html.includes('overflow-y-scroll'));
        assert.ok(!html.includes('overflow-x-scroll'));
        assert.ok(!html.includes('100vh'));
        assert.ok(!html.includes('margin-bottom'));
        assert.ok(!html.includes('h-48'));
    });
}
