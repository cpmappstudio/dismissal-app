import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DurationMetricCard } from '../components/sections/dashboard/duration-metric-card';

test('duration cards share loading, empty, limit and accessible real-data states', () => {
  const trend = {
    startDate: '2026-01-01', endDate: '2026-01-02', limitReached: false,
    avgWaitMinutes: 0, avgSessionMinutes: 20,
    points: [
      { date: '2026-01-01', waitMinutes: 0, sessionMinutes: 20 },
      { date: '2026-01-02', waitMinutes: null, sessionMinutes: null },
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
    assert.match(html, /by day, in minutes/);
  }
});
