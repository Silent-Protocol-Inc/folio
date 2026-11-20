/* Pure cash-balance calculations shared by the browser UI and regression tests. */
const round = amount => Math.round(amount * 100) / 100;

export const transactionBase = item => round(item.amount * item.rate);

export const cashBalanceThrough = (transactions, date) => transactions
  .filter(item => item.date <= date)
  .reduce((total, item) => total + (item.type === 'income' ? 1 : -1) * transactionBase(item), 0);

export const balanceDelta = (transactions, date, actual, reportRate) =>
  round(actual - cashBalanceThrough(transactions, date) / reportRate);
