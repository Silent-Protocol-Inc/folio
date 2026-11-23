import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liquidAccountBalances, sortTransactions, trackedAssetTotal } from '../public/assets.js';

const tx = (id, date, title, type, amount, accountId = '') => ({ id, date, title, type, amount, rate: 1, accountId });

test('transactions sort stably by date, value, and name in either direction', () => {
  const rows = [
    tx('b', '2026-11-02', 'Coffee', 'expense', 20),
    tx('a', '2026-11-02', 'Allowance', 'income', 100),
    tx('c', '2026-10-30', 'Bonus', 'income', 500),
  ];
  assert.deepEqual(sortTransactions(rows, 'date', 'desc').map((row) => row.id), ['a', 'b', 'c']);
  assert.deepEqual(sortTransactions(rows, 'date', 'asc').map((row) => row.id), ['c', 'a', 'b']);
  assert.deepEqual(sortTransactions(rows, 'value', 'desc').map((row) => row.id), ['c', 'a', 'b']);
  assert.deepEqual(sortTransactions(rows, 'name', 'asc').map((row) => row.id), ['a', 'c', 'b']);
});

test('liquid account balances derive from linked transactions without duplicating legacy cash', () => {
  const accounts = [{ id: 'bank', name: 'Main bank', type: 'bank' }, { id: 'cash', name: 'Wallet', type: 'cash' }];
  const rows = [
    tx('1', '2026-11-01', 'Opening bank', 'income', 1_000, 'bank'),
    tx('2', '2026-11-02', 'Groceries', 'expense', 200, 'bank'),
    tx('3', '2026-11-02', 'Cash opening', 'income', 300, 'cash'),
    tx('4', '2026-11-03', 'Legacy income', 'income', 50),
  ];
  assert.deepEqual(liquidAccountBalances(accounts, rows, '2026-11-30'), [
    { ...accounts[0], balance: 800 },
    { ...accounts[1], balance: 300 },
  ]);
  assert.equal(trackedAssetTotal(accounts, rows, [], '2026-11-30'), 1_150);
});

test('tracked value combines liquid cash with priced investment market value', () => {
  const accounts = [{ id: 'bank', name: 'Bank', type: 'bank' }];
  const rows = [tx('1', '2026-11-01', 'Opening', 'income', 2_000, 'bank')];
  const investments = [{
    id: 'btc', currency: 'USD', kind: 'crypto', mark: { price: 120, rate: 16_000, date: '2026-11-20' },
    activity: [{ id: 'buy', type: 'buy', date: '2026-11-01', quantity: 0.5, price: 100, fee: 0, rate: 16_000, note: '' }],
  }];
  assert.equal(trackedAssetTotal(accounts, rows, investments, '2026-11-30'), 962_000);
});
