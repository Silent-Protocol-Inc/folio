import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balanceDelta, cashBalanceThrough } from '../public/balance.js';

const transaction = (date, type, amount, extra = {}) => ({ date, type, amount, rate: 1, ...extra });

test('opening balance creates the full correction for an empty ledger', () => {
  assert.equal(balanceDelta([], '2026-11-20', 2_500_000, 1), 2_500_000);
});

test('later balance corrections use the tracked balance on the effective date', () => {
  const rows = [
    transaction('2026-11-01', 'income', 1_000),
    transaction('2026-11-05', 'expense', 250),
    transaction('2026-11-08', 'income', 100, { balanceAdjustment: true }),
    transaction('2026-11-25', 'expense', 500),
  ];
  assert.equal(cashBalanceThrough(rows, '2026-11-20'), 850);
  assert.equal(balanceDelta(rows, '2026-11-20', 700, 1), -150);
});

test('reporting-currency input is converted against the saved report rate', () => {
  const rows = [transaction('2026-11-01', 'income', 1_600_000)];
  assert.equal(balanceDelta(rows, '2026-11-20', 90, 16_000), -10);
});
