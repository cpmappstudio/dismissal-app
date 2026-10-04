import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Progress } from '../components/ui/progress';

test('progress exposes its value and fill consistently, including empty and completed states', () => {
  for (const value of [0, 50, 100]) {
    const html = renderToStaticMarkup(createElement(Progress, { value, 'aria-label': 'Pickup progress' }));
    assert.match(html, /role="progressbar"/);
    assert.ok(html.includes(`aria-valuenow="${value}"`));
    assert.ok(html.includes(`width:${value}%`));
    assert.match(html, /motion-reduce:transition-none/);
  }
});
