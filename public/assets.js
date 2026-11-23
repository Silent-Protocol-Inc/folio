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
    return total + holdingUnits(holding) * holding.mark.price * holding.mark.rate;
  }, 0));
}

const categoryNames = {
  bank: 'Bank', cash: 'Cash', emoney: 'E-wallet', crypto: 'Cryptocurrency', stock: 'Stock', investment: 'Investments', other: 'Other',
};

function holdingUnits(holding) {
  return holding.activity.reduce((count, event) => {
    if (event.type === 'buy') return count + event.quantity;
    if (event.type === 'sell') return count - event.quantity;
    return count;
  }, 0);
}

function holdingValue(holding) {
  const units = holdingUnits(holding);
  return holding.mark && units > 0 ? round(units * holding.mark.price * holding.mark.rate) : null;
}

export function assetCategoryRows(categories, groups, accounts, transactions, investments, throughDate) {
  const result = categories.map(category => ({ ...category, total: 0, entries: [], groups: [] }));
  const byId = new Map(result.map(category => [category.id, category]));
  const byType = new Map();
  for (const category of result) if (!byType.has(category.type)) byType.set(category.type, category);
  const categoryFor = (id, type) => {
    if (id && byId.has(id)) return byId.get(id);
    if (byType.has(type)) return byType.get(type);
    const category = { id: `legacy:${type}`, name: categoryNames[type] ?? categoryNames.other, type, total: 0, entries: [], groups: [] };
    result.push(category);
    byId.set(category.id, category);
    byType.set(type, category);
    return category;
  };
  const groupById = new Map();
  for (const group of groups) {
    const category = byId.get(group.categoryId);
    if (!category) continue;
    const row = { ...group, total: 0, entries: [] };
    category.groups.push(row);
    groupById.set(group.id, row);
  }
  const add = (category, group, entry) => {
    (group?.entries ?? category.entries).push(entry);
    if (entry.value !== null) {
      category.total = round(category.total + entry.value);
      if (group) group.total = round(group.total + entry.value);
    }
  };
  for (const account of liquidAccountBalances(accounts, transactions, throughDate)) {
    const category = categoryFor(account.categoryId, account.type);
    add(category, groupById.get(account.groupId), { id: account.id, name: account.name, value: account.balance, source: 'account' });
  }
  const assigned = transactions
    .filter(item => item.accountId && item.date <= throughDate)
    .reduce((total, item) => total + signedBase(item), 0);
  const liquid = transactions
    .filter(item => item.date <= throughDate)
    .reduce((total, item) => total + signedBase(item), 0);
  const unassigned = round(liquid - assigned);
  if (unassigned) add(categoryFor('', 'cash'), null, { id: 'legacy:unassigned', name: 'Unassigned cash', value: unassigned, source: 'legacy' });
  const legacyGroups = new Map();
  for (const holding of investments) {
    const type = holding.kind === 'crypto' || holding.kind === 'stock' ? holding.kind : 'investment';
    const category = categoryFor(holding.categoryId, type);
    let group = groupById.get(holding.groupId);
    if (!group && holding.account) {
      const key = `${category.id}:${holding.account.toLocaleLowerCase()}`;
      group = legacyGroups.get(key);
      if (!group) {
        group = { id: `legacy:${key}`, categoryId: category.id, name: holding.account, total: 0, entries: [] };
        category.groups.push(group);
        legacyGroups.set(key, group);
      }
    }
    const name = holding.symbol ? `${holding.name} · ${holding.symbol}` : holding.name;
    add(category, group, { id: holding.id, name, value: holdingValue(holding), source: 'investment' });
  }
  return result;
}

export function trackedAssetTotal(accounts, transactions, investments, throughDate) {
  const liquid = transactions
    .filter(item => item.date <= throughDate)
    .reduce((total, item) => total + signedBase(item), 0);
  return round(liquid + investmentMarketValue(investments));
}
