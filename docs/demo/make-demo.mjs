// Builds docs/demo/demo-workspace.json: a fictional sample workspace (IDR, June to November 2026) for screenshots and
// for trying Folio. Import it under Settings → Import backup. Every name and number here is made up.
// Usage: node docs/demo/make-demo.mjs
import { writeFileSync } from "node:fs";

let n = 0;
const id = (p) => `${p}-${String(++n).padStart(4, "0")}`;
const base = { currency: "IDR", rate: 1, note: "" };
const months = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"];
const day = (m, d) => `${m}-${String(d).padStart(2, "0")}`;
const assetCategories = [
  { id: "category-bank", name: "Bank", type: "bank" },
  { id: "category-cash", name: "Cash", type: "cash" },
  { id: "category-crypto", name: "Cryptocurrency", type: "crypto" },
  { id: "category-stock", name: "Stock", type: "stock" },
  { id: "category-ewallet", name: "E-wallet", type: "emoney" },
  { id: "category-investment", name: "Other investments", type: "investment" },
];
const assetGroups = [
  { id: "group-triv", categoryId: "category-crypto", name: "Triv" },
  { id: "group-gotrade", categoryId: "category-stock", name: "Gotrade" },
  { id: "group-stockbit", categoryId: "category-stock", name: "Stockbit" },
  { id: "group-bibit", categoryId: "category-investment", name: "Bibit" },
];
const accounts = [
  { id: "account-bca", name: "BCA payroll", type: "bank", categoryId: "category-bank" },
  { id: "account-jago", name: "Jago", type: "bank", categoryId: "category-bank" },
  { id: "account-wallet", name: "Wallet", type: "cash", categoryId: "category-cash" },
  { id: "account-pocket", name: "Pocket", type: "cash", categoryId: "category-cash" },
  { id: "account-dana", name: "DANA", type: "emoney", categoryId: "category-ewallet" },
  { id: "account-ovo", name: "OVO", type: "emoney", categoryId: "category-ewallet" },
];
const accountId = (name) => accounts.find((account) => account.name === name)?.id;
const tx = (date, type, title, amount, category, account = "BCA payroll") => ({ ...base, id: id("tx"), date, type, title, amount, category, account, accountId: accountId(account) });

const transactions = [];
for (const [account, amount] of [["BCA payroll", 6_000_000], ["Jago", 3_000_000], ["Wallet", 500_000], ["Pocket", 250_000], ["DANA", 300_000], ["OVO", 175_000]]) {
  transactions.push({ ...base, id: id("tx"), date: "2026-06-01", type: "income", title: "Opening balance", amount, category: "Balance adjustment", account, accountId: accountId(account), balanceAdjustment: true, note: `Opening balance for ${account}` });
}
months.forEach((m, i) => {
  const last = m === "2026-11"; // the current month is still running
  transactions.push(tx(day(m, 1), "income", "Monthly salary", 18_500_000, "Salary"));
  if (i % 2 === 1) transactions.push(tx(day(m, 12), "income", "Website project", 3_250_000 + i * 250_000, "Freelance", "Jago"));
  transactions.push(tx(day(m, 2), "expense", "Rent, Kemang studio", 5_200_000, "Housing"));
  transactions.push(tx(day(m, 5), "expense", "Electricity and water", 640_000 + i * 15_000, "Bills"));
  transactions.push(tx(day(m, 6), "expense", "Mobile data plan", 150_000, "Bills", "Jago"));
  transactions.push(tx(day(m, 8), "expense", "Groceries", 1_150_000 + (i % 3) * 120_000, "Food & drink"));
  transactions.push(tx(day(m, 14), "expense", "Lunches and coffee", 860_000 + (i % 2) * 90_000, "Food & drink", "Jago"));
  transactions.push(tx(day(m, 10), "expense", "Commuter line and ride-hailing", 520_000 + (i % 3) * 40_000, "Transport", "Jago"));
  if (!last) transactions.push(tx(day(m, 20), "expense", "Weekend dinner", 420_000 + i * 20_000, "Entertainment", "Jago"));
  if (i === 2) transactions.push(tx(day(m, 18), "expense", "Running shoes", 1_350_000, "Shopping", "BCA payroll"));
  if (i === 4) transactions.push(tx(day(m, 22), "expense", "Dentist check-up", 750_000, "Health"));
  if (i === 3) transactions.push(tx(day(m, 16), "expense", "Online design course", 990_000, "Education", "Jago"));
  if (!last) transactions.push(tx(day(m, 25), "expense", "Credit card payment", 1_500_000, "Debt payment"));
});

const debts = [
  { ...base, id: id("debt"), title: "Credit card balance", source: "Credit card", direction: "owe", amount: 9_000_000, due: "2027-03-25", lead: 5,
    payments: months.slice(0, 5).map((m) => ({ date: day(m, 25), amount: 1_500_000 })) },
  { ...base, id: id("debt"), title: "Loan to Rina for her laptop", source: "Person", direction: "owed", amount: 2_400_000, due: "2026-12-31", lead: 7,
    payments: [{ date: "2026-09-30", amount: 800_000 }, { date: "2026-10-31", amount: 800_000 }] },
];

const subscriptions = [
  { ...base, id: id("sub"), title: "Spotify Premium", amount: 54_990, cycle: "monthly", due: "2026-11-28", status: "active", lead: 3 },
  { ...base, id: id("sub"), title: "Netflix Standard", amount: 120_000, cycle: "monthly", due: "2026-12-03", status: "active", lead: 3 },
  { ...base, id: id("sub"), title: "iCloud+ 200 GB", amount: 49_000, cycle: "monthly", due: "2026-12-09", status: "active", lead: 3 },
  { ...base, id: id("sub"), title: "Gym membership", amount: 450_000, cycle: "monthly", due: "2026-12-01", status: "active", lead: 5 },
  { ...base, id: id("sub"), title: "Domain renewal", amount: 230_000, cycle: "yearly", due: "2027-02-14", status: "active", lead: 14 },
];

const goals = [
  { ...base, id: id("goal"), title: "Emergency fund (6 months)", amount: 60_000_000, due: "2027-12-31",
    contributions: months.map((m) => ({ date: day(m, 3), amount: 2_500_000 })) },
  { ...base, id: id("goal"), title: "Japan trip, spring 2027", amount: 25_000_000, due: "2027-03-15",
    contributions: months.slice(1).map((m) => ({ date: day(m, 4), amount: 1_750_000 })) },
  { ...base, id: id("goal"), title: "New laptop", amount: 18_000_000, due: "2027-06-30",
    contributions: [{ date: "2026-10-04", amount: 1_000_000 }, { date: "2026-11-04", amount: 1_000_000 }] },
];

const budgets = [
  ["Food & drink", 2_300_000], ["Transport", 650_000], ["Bills", 900_000], ["Entertainment", 600_000], ["Shopping", 750_000],
].map(([category, amount]) => ({ ...base, id: id("budget"), title: category, category, amount }));

const buy = (date, quantity, price, fee = 0) => ({ id: id("act"), type: "buy", date, quantity, price, fee, rate: 1, note: "" });
const income = (date, price) => ({ id: id("act"), type: "income", date, quantity: 0, price, fee: 0, rate: 1, note: "" });
const investments = [
  { id: id("inv"), name: "Ethereum", symbol: "ETH", kind: "crypto", account: "Triv", categoryId: "category-crypto", groupId: "group-triv", currency: "IDR",
    mark: { date: "2026-11-18", price: 52_000_000, rate: 1 }, activity: [buy("2026-09-12", 0.18, 48_000_000)] },
  { id: id("inv"), name: "NVIDIA", symbol: "NVDA", kind: "stock", account: "Gotrade", categoryId: "category-stock", groupId: "group-gotrade", currency: "IDR",
    mark: { date: "2026-11-18", price: 3_080_000, rate: 1 }, activity: [buy("2026-08-20", 2, 2_760_000)] },
  { id: id("inv"), name: "Money market fund", symbol: "RDPU", kind: "fund", account: "Bibit", categoryId: "category-investment", groupId: "group-bibit", currency: "IDR",
    mark: { date: "2026-11-18", price: 2_046, rate: 1 }, activity: months.map((m) => buy(day(m, 3), 250, 2_000)) },
  { id: id("inv"), name: "Retail government bond ORI028", symbol: "ORI028", kind: "bond", account: "Bank", currency: "IDR",
    mark: { date: "2026-11-18", price: 1_000_000, rate: 1 }, activity: [buy("2026-07-15", 10, 1_000_000), income("2026-10-15", 156_000)] },
  { id: id("inv"), name: "Gold savings", symbol: "XAU (g)", kind: "metal", account: "Pegadaian", currency: "IDR",
    mark: { date: "2026-11-18", price: 1_745_000, rate: 1 }, activity: [buy("2026-06-20", 2, 1_610_000), buy("2026-09-20", 1, 1_690_000)] },
  { id: id("inv"), name: "Bank Central Asia", symbol: "BBCA", kind: "stock", account: "Stockbit", categoryId: "category-stock", groupId: "group-stockbit", currency: "IDR",
    mark: { date: "2026-11-18", price: 9_650, rate: 1 }, activity: [buy("2026-08-05", 300, 9_200, 4_140), income("2026-11-06", 51_000)] },
];

const workspace = { version: 1, demo: false, currency: "IDR", reportRate: 1, reportDate: "", assetCategories, assetGroups, accounts, transactions, debts, subscriptions, goals, budgets, investments };
writeFileSync(new URL("./demo-workspace.json", import.meta.url), JSON.stringify(workspace, null, 1) + "\n");
console.log(`demo-workspace.json: ${transactions.length} transactions, ${debts.length} debts, ${subscriptions.length} subscriptions, ${goals.length} goals, ${budgets.length} budgets, ${investments.length} holdings`);
