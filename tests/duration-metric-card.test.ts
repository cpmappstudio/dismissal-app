import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DurationMetricCard } from '../components/sections/dashboard/duration-metric-card';

test('duration cards share loading, empty, limit and accessible real-data states', () => {
  const trend = {
    startDate: '2026-01-01', endDate: '2026-01-03', limitReached: false,
    avgWaitMinutes: 2, avgSessionMinutes: 30,
    points: [
      { date: '2026-01-01', waitMinutes: 0, sessionMinutes: 20 },
      { date: '2026-01-02', waitMinutes: null, sessionMinutes: null },
      { date: '2026-01-03', waitMinutes: 4, sessionMinutes: 40 },
    ],
  };
  for (const metric of ['wait', 'session'] as const) {
    const render = (data: typeof trend | null | undefined) => renderToStaticMarkup(createElement(DurationMetricCard, { metric, trend: data }));
    assert.match(render(undefined), /role="status" aria-label="Loading/);
    assert.match(render(null), /No pickup data for this period/);
    assert.match(render({ ...trend, limitReached: true }), /No partial averages are shown/);
    const html = render(trend);
    assert.doesNotMatch(html, /No pickup data/);
    assert.match(html, /Completed days · Road pickups/);
    assert.match(html, new RegExp(`<td>${metric === 'wait' ? 0 : 20}</td>`));
    assert.doesNotMatch(html, /<th scope="row">2026-01-02/);
    assert.match(html, /<th scope="row">2026-01-03/);
    assert.match(html, /by day, in minutes/);
  }
});

test('duration areas bridge missing days with a gradient without replacing the data', () => {
  const source = readFileSync(new URL('../components/sections/dashboard/duration-metric-card.tsx', import.meta.url), 'utf8');
  assert.match(source, /<AreaChart[^>]*data=\{trend!\.points\}/);
  assert.match(source, /<Area\s[^>]*\bconnectNulls(?:\s|>)/);
  assert.match(source, /<Area\s[^>]*fill=\{`url\(#fill-\$\{id\}\)`\}/);
  assert.match(source, /<Area\s[^>]*fillOpacity=\{0\.4\}/);
});
