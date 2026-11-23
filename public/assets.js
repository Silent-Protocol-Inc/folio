/* Pure tracked-asset and transaction-order helpers shared by the UI and tests. */
const round = amount => Math.round(amount * 100) / 100;
const base = item => round(item.amount * item.rate);
const signedBase = item => (item.type === 'income' ? 1 : -1) * base(item);

const compareText = (left, right) => String(left).localeCompare(String(right), undefined, { sensitivity: 'base' });

export function sortTransactions(rows, key = 'date', direction = 'desc') {
  const sign = direction === 'asc' ? 1 : -1;
  const compare = key === 'value'
    ? (left, right) => base(left) - base(right)
    : key === 'name'
      ? (left, right) => compareText(left.title, right.title)
      : (left, right) => compareText(left.date, right.date);
  return [...rows].sort((left, right) => sign * compare(left, right) || compareText(left.id, right.id));
}

export function liquidAccountBalances(accounts, transactions, throughDate) {
  return accounts.map(account => ({
    ...account,
    balance: round(transactions
      .filter(item => item.accountId === account.id && item.date <= throughDate)
      .reduce((total, item) => total + signedBase(item), 0)),
  }));
}

export function investmentMarketValue(investments) {
  return round(investments.reduce((total, holding) => {
    if (!holding.mark) return total;
    const units = holding.activity.reduce((count, event) => {
      if (event.type === 'buy') return count + event.quantity;
      if (event.type === 'sell') return count - event.quantity;
      return count;
    }, 0);
    return total + units * holding.mark.price * holding.mark.rate;
  }, 0));
}

export function trackedAssetTotal(accounts, transactions, investments, throughDate) {
  const liquid = transactions
    .filter(item => item.date <= throughDate)
    .reduce((total, item) => total + signedBase(item), 0);
  return round(liquid + investmentMarketValue(investments));
}
