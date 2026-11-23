/*
 * Server-side shape check for a workspace before it is stored (PUT /api/workspace). The browser runs a
 * stricter check on imported backups (validBackup in public/app.js). Format: docs/ARCHITECTURE.md#data-model.
 */
const currency=/^[A-Z]{3}$/;
const date=/^\d{4}-\d{2}-\d{2}$/;
const text=value=>typeof value==='string'&&value.length<=2000;
const record=list=>Array.isArray(list)&&list.length<=20000;
const dated=value=>typeof value==='string'&&date.test(value)&&Number.isFinite(Date.parse(value));
const coded=value=>typeof value==='string'&&currency.test(value);
const id=value=>text(value)&&value.length>0;
const positive=value=>Number.isFinite(value)&&value>0;
const nonnegative=value=>Number.isFinite(value)&&value>=0;
const notes=value=>value===undefined||text(value);
const optionalId=value=>value===undefined||text(value);
const list=(rows,validate)=>record(rows)&&rows.every(row=>row&&typeof row==='object'&&validate(row));
const general=row=>id(row.id)&&text(row.title)&&notes(row.note)&&coded(row.currency)&&positive(row.amount)&&positive(row.rate);
const moneyPoint=row=>dated(row.date)&&Number.isFinite(row.amount);
const activity=row=>id(row.id)&&dated(row.date)&&['buy','sell','income'].includes(row.type)&&Number.isFinite(row.quantity)&&nonnegative(row.price)&&nonnegative(row.fee)&&positive(row.rate)&&notes(row.note);
const categoryTypes=['bank','cash','emoney','crypto','stock','investment','other'];
const holding=(row,categoryIds,groupById)=>id(row.id)&&text(row.name)&&text(row.symbol)&&text(row.kind)&&text(row.account)&&coded(row.currency)&&
 optionalId(row.categoryId)&&optionalId(row.groupId)&&(!row.categoryId||categoryIds.has(row.categoryId))&&
 (!row.groupId||(groupById.has(row.groupId)&&groupById.get(row.groupId)===row.categoryId))&&list(row.activity,activity)&&
 (row.mark===null||(row.mark&&nonnegative(row.mark.price)&&positive(row.mark.rate)&&dated(row.mark.date)));
export function admissibleWorkspace(state){
 const accounts=state?.accounts??[];
 const accountIds=new Set(accounts.map(row=>row?.id));
 const categories=state?.assetCategories??[];
 const categoryIds=new Set(categories.map(row=>row?.id));
 const groups=state?.assetGroups??[];
 const groupById=new Map(groups.map(row=>[row?.id,row?.categoryId]));
 return state?.version===1&&state.demo===false&&coded(state.currency)&&positive(state.reportRate)&&(!state.reportDate||dated(state.reportDate))&&
  list(categories,row=>id(row.id)&&text(row.name)&&categoryTypes.includes(row.type))&&categoryIds.size===categories.length&&
  list(groups,row=>id(row.id)&&text(row.name)&&id(row.categoryId)&&categoryIds.has(row.categoryId))&&groupById.size===groups.length&&
  list(accounts,row=>id(row.id)&&text(row.name)&&['bank','emoney','cash','other'].includes(row.type)&&optionalId(row.categoryId)&&optionalId(row.groupId)&&
   (!row.categoryId||categoryIds.has(row.categoryId))&&(!row.groupId||(groupById.has(row.groupId)&&groupById.get(row.groupId)===row.categoryId)))&&accountIds.size===accounts.length&&
  list(state.transactions,row=>general(row)&&dated(row.date)&&['income','expense'].includes(row.type)&&text(row.account)&&text(row.category)&&
   optionalId(row.accountId)&&(row.accountId===undefined||accountIds.has(row.accountId))&&
   (row.balanceAdjustment===undefined||(row.balanceAdjustment===true&&row.category==='Balance adjustment')))&&
  list(state.debts,row=>general(row)&&text(row.source)&&['owe','owed'].includes(row.direction)&&(!row.due||dated(row.due))&&Number.isInteger(row.lead)&&list(row.payments,moneyPoint))&&
  list(state.subscriptions,row=>general(row)&&dated(row.due)&&['monthly','weekly','yearly'].includes(row.cycle)&&['active','paused'].includes(row.status)&&Number.isInteger(row.lead))&&
  list(state.goals,row=>general(row)&&(!row.due||dated(row.due))&&list(row.contributions,moneyPoint))&&
  list(state.budgets,row=>general(row)&&text(row.category))&&list(state.investments,row=>holding(row,categoryIds,groupById));
}
