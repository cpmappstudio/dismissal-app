import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('dashboard rankings share one responsive card, including loading and empty states', () => {
  const source = (file: string) => readFileSync(new URL(`../components/sections/dashboard/${file}.tsx`, import.meta.url), 'utf8');
  const dashboard = source('dismissal-dashboard');
  assert.equal(dashboard.match(/<Card\b/g)?.length, 1);
  assert.match(dashboard, /<Card[^]*<CampusActivityCard \/>[^]*<TopArrivalsCard \/>[^]*<\/Card>/);
  assert.ok(dashboard.includes('grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))]'));
  assert.match(dashboard, /gap-px bg-border \[&>section\]:bg-card/);
  assert.doesNotMatch(dashboard, /@container|@3xl:/);
  for (const file of ['campus-activity-card', 'top-arrivals-card']) {
    const ranking = source(file);
    assert.doesNotMatch(ranking, /<Card[\s>]/);
    assert.equal(ranking.match(/<section className="min-w-0 space-y-6 py-6">/g)?.length, 3);
    assert.match(ranking, /min-w-0 max-w-32 flex-1/);
    assert.match(ranking, /w-full max-w-20 rounded-t-lg/);
  }
});
