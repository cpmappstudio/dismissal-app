import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/react-table';
import { DEFAULT_TABLE_PAGE_SIZE } from '../components/dashboard/table-pagination';

test('management tables display 25 rows and preserve paging and filtering', () => {
  assert.equal(DEFAULT_TABLE_PAGE_SIZE, 25);
  for (const name of ['students', 'staff']) {
    const source = readFileSync(new URL(`../components/dashboard/${name}-table/${name}-table.tsx`, import.meta.url), 'utf8');
    assert.match(source, /pageSize: DEFAULT_TABLE_PAGE_SIZE/);
  }
  const data = Array.from({ length: 53 }, (_, id) => ({ id, group: id < 30 ? 'A' : 'B' }));
  const table = createTable({
    data, columns: [{ accessorKey: 'id' }, { accessorKey: 'group', filterFn: 'equalsString' }],
    state: { pagination: { pageIndex: 0, pageSize: DEFAULT_TABLE_PAGE_SIZE }, columnFilters: [] },
    onStateChange: () => {}, renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  assert.equal(table.getPageCount(), 3);
  assert.equal(table.getRowModel().rows.length, 25);
  table.setOptions(previous => ({ ...previous, state: { ...previous.state, pagination: { pageIndex: 1, pageSize: DEFAULT_TABLE_PAGE_SIZE } } }));
  assert.equal(table.getRowModel().rows[0].original.id, 25);
  assert.equal(table.getRowModel().rows.length, 25);
  table.setOptions(previous => ({ ...previous, state: { ...previous.state, pagination: { pageIndex: 2, pageSize: DEFAULT_TABLE_PAGE_SIZE } } }));
  assert.deepEqual(table.getRowModel().rows.map(row => row.original.id), [50, 51, 52]);
  table.setOptions(previous => ({ ...previous, state: { ...previous.state, pagination: { pageIndex: 0, pageSize: DEFAULT_TABLE_PAGE_SIZE }, columnFilters: [{ id: 'group', value: 'B' }] } }));
  assert.equal(table.getPageCount(), 1);
  assert.equal(table.getRowModel().rows.length, 23);
});
