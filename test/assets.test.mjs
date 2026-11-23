import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetCategoryRows, liquidAccountBalances, sortTransactions, trackedAssetTotal } from '../public/assets.js';

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

test('asset hierarchy groups liquid sources and investments under optional subcategories', () => {
  const categories = [
    { id: 'banking', name: 'Bank', type: 'bank' },
    { id: 'cash', name: 'Cash', type: 'cash' },
    { id: 'crypto', name: 'Cryptocurrency', type: 'crypto' },
    { id: 'stock', name: 'Stock', type: 'stock' },
  ];
  const groups = [
    { id: 'triv', categoryId: 'crypto', name: 'Triv' },
    { id: 'gotrade', categoryId: 'stock', name: 'Gotrade' },
  ];
  const accounts = [
    { id: 'blu', name: 'Bank Blu', type: 'bank', categoryId: 'banking' },
    { id: 'wallet', name: 'Wallet', type: 'cash', categoryId: 'cash' },
  ];
  const transactions = [
    tx('1', '2026-11-01', 'Blu opening', 'income', 500_000, 'blu'),
    tx('2', '2026-11-01', 'Wallet opening', 'income', 100_000, 'wallet'),
  ];
  const investments = [
    {
      id: 'eth', name: 'Ethereum', symbol: 'ETH', kind: 'crypto', categoryId: 'crypto', groupId: 'triv', currency: 'IDR',
      mark: { price: 40_000_000, rate: 1, date: '2026-11-20' },
      activity: [{ id: 'buy-eth', type: 'buy', date: '2026-11-01', quantity: 0.25, price: 35_000_000, fee: 0, rate: 1, note: '' }],
    },
    {
      id: 'nvda', name: 'NVIDIA', symbol: 'NVDA', kind: 'stock', categoryId: 'stock', groupId: 'gotrade', currency: 'USD',
      mark: { price: 200, rate: 16_000, date: '2026-11-20' },
      activity: [{ id: 'buy-nvda', type: 'buy', date: '2026-11-01', quantity: 2, price: 180, fee: 0, rate: 16_000, note: '' }],
    },
  ];

  const result = assetCategoryRows(categories, groups, accounts, transactions, investments, '2026-11-30');
  assert.deepEqual(result.map((category) => [category.name, category.total]), [
    ['Bank', 500_000],
    ['Cash', 100_000],
    ['Cryptocurrency', 10_000_000],
    ['Stock', 6_400_000],
  ]);
  assert.deepEqual(result[2].groups[0].entries.map((entry) => entry.name), ['Ethereum · ETH']);
  assert.equal(result[2].groups[0].total, 10_000_000);
  assert.deepEqual(result[3].groups[0].entries.map((entry) => entry.name), ['NVIDIA · NVDA']);
});

test('asset hierarchy keeps legacy sources visible without mutating old backups', () => {
  const accounts = [{ id: 'dana', name: 'DANA', type: 'emoney' }];
  const transactions = [tx('1', '2026-11-01', 'Opening', 'income', 250_000, 'dana')];
  const result = assetCategoryRows([], [], accounts, transactions, [], '2026-11-30');
  assert.deepEqual(result.map((category) => [category.name, category.total]), [['E-wallet', 250_000]]);
  assert.equal(result[0].entries[0].name, 'DANA');
});

test('asset hierarchy places aggregate unassigned cash in its managed category and subcategory', () => {
  const categories = [{ id: 'cash', name: 'Cash', type: 'cash' }];
  const groups = [{ id: 'wallets', categoryId: 'cash', name: 'Wallets' }];
  const transactions = [tx('1', '2026-11-01', 'Legacy opening', 'income', 450_000)];
  const assignment = { categoryId: 'cash', groupId: 'wallets' };

  const result = assetCategoryRows(categories, groups, [], transactions, [], '2026-11-30', assignment);
  assert.equal(result.length, 1);
  assert.equal(result[0].entries.length, 0);
  assert.deepEqual(result[0].groups[0].entries, [{
    id: 'legacy:unassigned', name: 'Unassigned cash', value: 450_000, source: 'legacy',
  }]);
  assert.equal(result[0].groups[0].total, 450_000);
});
