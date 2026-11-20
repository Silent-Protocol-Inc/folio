/*
 * Folio workspace UI (loaded by auth.js after sign-in): hash routes (#overview, #transactions, #budgets,
 * #debts, #subscriptions, #goals, #currency, #investments), forms and dialogs, charts, reminders, backup
 * export/import, and save(), which PUTs the whole workspace with its revision (409 = changed elsewhere).
 */
'use strict';

const $ = (selector,root=document) => root.querySelector(selector);
const storageKey = 'folio-money-v1';
const currencies = 'IDR USD EUR GBP JPY SGD MYR AUD CAD CHF CNY HKD KRW THB PHP VND TWD INR NZD AED SAR BRL MXN ZAR SEK NOK DKK PLN TRY'.split(' ');
const expenseCategories = ['Food & drink','Shopping','Housing','Transport','Bills','Health','Entertainment','Education','Travel','Debt payment','Subscriptions','Other'];
const incomeCategories = ['Salary','Freelance','Debt repayment','Other'];
const allCategories = [...new Set([...incomeCategories,...expenseCategories])];
const sources = ['Person','Online lender','Bank','Credit card','Other'];
const cycles = {weekly:'Weekly',monthly:'Monthly',yearly:'Yearly'};
const icons = {
 investment:'<path d="M3 4v16h18M6 14l5-5 4 3 5-6m-5 0h5v5"/>',
 dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 transaction:'<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',budget:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18m-13 6h3"/>',
 debt:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-11 5h6m-4-2v4"/>',
 subscription:'<path d="m17 2 4 4-4 4m4-4H7a4 4 0 0 0-4 4m4 12-4-4 4-4m-4 4h14a4 4 0 0 0 4-4"/>',
 goal:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 currency:'<path d="M5 9h13m-4-4 4 4-4 4m5 2H6m4-4-4 4 4 4"/><circle cx="12" cy="12" r="10"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M9 3h6l1 3 3 1 2 4-2 2v2l1 2-2 3-3-1-2 2h-3l-2-2-3 1-2-3 1-2v-2l-2-2 2-4 3-1z"/>',
 bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',chevron:'<path d="m9 6 6 6-6 6"/>',left:'<path d="m15 6-6 6 6 6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',
 wallet:'<path d="M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a3 3 0 0 1-3-3V7m18 6h-5a2 2 0 0 0 0 4h5"/>',
 up:'<path d="M6 17 17 6M8 6h9v9"/>',down:'<path d="M17 6 6 17m0-9v9h9"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
 arrow:'<path d="M3 12h17m-7-6 6 6-6 6"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 coffee:'<path d="M3 8h14v7a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zm14 0h2a2 2 0 1 1 0 4h-2M8 3v2m4-2v2"/>',
 bag:'<path d="M4 8h16l1 13H3zm5 2V6a3 3 0 1 1 6 0v4"/>',car:'<path d="m4 10 2-5h12l2 5m-16 0h16l1 3v5H3v-5zm1 8v2m14-2v2M7 14h1m8 0h1"/>',
 home:'<path d="m3 10 9-7 9 7v10h-6v-6H9v6H3Z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
 edit:'<path d="m4 16 11-11a2 2 0 0 1 3 0l1 1a2 2 0 0 1 0 3L8 20H4zm9-9 4 4"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',check:'<path d="m4 12 5 5L20 6"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
const blockIcon = (name,tone='') => '<span class="ico '+tone+'">'+icon(name)+'</span>';
const safe = value => String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pad = n => String(n).padStart(2,'0');
const ymd = date => date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate());
const today = () => ymd(new Date());
const parseDate = value => new Date(value+'T12:00:00');
const displayDate = value => parseDate(value).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const shiftDays = (value,count) => {const date=parseDate(value);date.setDate(date.getDate()+count);return ymd(date);};
const shiftMonth = (value,count) => {const date=parseDate(value+'-01');date.setMonth(date.getMonth()+count);return ymd(date).slice(0,7);};
const daysAway = value => Math.round((Date.parse(value+'T00:00:00Z')-Date.parse(today()+'T00:00:00Z'))/86400000);
const monthLabel = (value,short=false) => parseDate(value+'-01').toLocaleDateString('en-GB',{month:'short',...(short?{}:{year:'numeric'})});
function nextRenewal(record) {
 if(record.cycle==='weekly')return shiftDays(record.due,7);
 const month=shiftMonth(record.due.slice(0,7),record.cycle==='yearly'?12:1);
 const end=parseDate(shiftMonth(month,1)+'-01');
 end.setDate(0);
 return month+'-'+pad(Math.min(record.anchor||Number(record.due.slice(-2)),end.getDate()));
}
const uid = () => crypto.randomUUID();
const currencyDecimals = new Map();
function money(amount,currency) {
 if(!currencyDecimals.has(currency))currencyDecimals.set(currency,new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits);
 const decimals=Number.isInteger(amount)?0:currencyDecimals.get(currency);
 const formatted=new Intl.NumberFormat('en-GB',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(Math.abs(amount));
 return (amount<0?'−':'')+(currency==='IDR'?'Rp':currency)+' '+formatted;
}
const compact = amount => new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(amount);
const round = amount => Math.round(amount*100)/100;
const sum = (list,read) => list.reduce((total,item)=>total+read(item),0);
const base = item => round(item.amount*item.rate);
const original = item => money(item.amount,item.currency);
const report = amount => money(amount/state.reportRate,state.currency);
const signed = item => (item.type==='income'?'+':'−')+original(item);
const outstanding = item => Math.max(0,round(item.amount-sum(item.payments,x=>x.amount)));
const savings = item => round(sum(item.contributions,x=>x.amount));
const collections = {transaction:'transactions',debt:'debts',subscription:'subscriptions',goal:'goals',budget:'budgets'};
const itemBy = (kind,id,db=state) => db[collections[kind]]?.find(item=>item.id===id);
const currentMonth = () => today().slice(0,7);
let month = currentMonth();
const dateSort = (a,b) => b.date.localeCompare(a.date);
const inMonth = value => state.transactions.filter(item=>item.date.startsWith(value));
const operational = list => list.filter(item=>!item.balanceAdjustment);
const totals = list => ({income:sum(operational(list).filter(x=>x.type==='income'),base),expense:sum(operational(list).filter(x=>x.type==='expense'),base)});
const cashBalanceThrough = date => window.Folio.balance.cashBalanceThrough(state.transactions,date);

function blank() {
 return {version:1,demo:false,currency:'IDR',reportRate:1,reportDate:'',transactions:[],debts:[],subscriptions:[],goals:[],budgets:[],investments:[]};
}
let state=window.Folio.workspace??blank();
let toastTimer;
function toast(text) {
 const element=$('#toast');
 element.textContent=text;element.classList.add('visible');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.classList.remove('visible'),3200);
}
let workspaceSaving=false;
async function save(next,message,close=false) {
 if(workspaceSaving){feedback('Folio is saving another change. Try again in a moment.');return false;}
 workspaceSaving=true;
 const form=$('form',modal);
 const submit=form?.querySelector('button[type=submit]');
 if(submit)submit.disabled=true;
 try{
  const {revision}=await window.Folio.api('workspace',{workspace:{...next,demo:false,investments:next.investments??[]},revision:window.Folio.revision},'PUT');
  window.Folio.revision=revision;
  state=next;
  if(close&&modal.open&&(!form||form.isConnected))modal.close();
  render();
  if(message)toast(message);
  return true;
 }catch(error){
  feedback(error.status===401?'Your session ended. Sign in again before saving.':error.message||'The changes could not be saved.');
  return false;
 }finally{
  workspaceSaving=false;
  if(submit)submit.disabled=false;
 }
}
function update(mutate,message,close=true) {
 const next=structuredClone(state);
 mutate(next);
 return save(next,message,close);
}
const pages = [['overview','Overview','dashboard'],['transactions','Transactions','transaction'],['budgets','Budgets','budget'],['debts','Debts','debt'],['subscriptions','Subscriptions','subscription'],['goals','Savings goals','goal'],['currency','Converter','currency'],['investments','Investments','investment']];
const pageMap=new Map(pages.map(item=>[item[0],item]));
const route=()=>pageMap.has(location.hash.slice(1))?location.hash.slice(1):'overview';
const button=(action,label,symbol='',style='btn',attrs='')=>'<button type="button" class="'+style+'" data-action="'+action+'" '+attrs+'>'+(symbol?icon(symbol):'')+safe(label)+'</button>';
const iconButton=(action,label,symbol,attrs='')=>button(action,'',symbol,'btn icon-button','aria-label="'+safe(label)+'" title="'+safe(label)+'" '+attrs);
const link=(page,label)=>'<a class="text-button" href="#'+page+'">'+safe(label)+icon('arrow')+'</a>';
const attr=item=>'data-id="'+safe(item.id)+'"';
const chip=(label,tone='')=>'<span class="chip '+tone+'">'+safe(label)+'</span>';
const empty=text=>'<p class="empty">'+safe(text)+'</p>';
const title=(name,description,extra='')=>'<header class="page-heading"><div><h1>'+safe(name)+'</h1><p>'+safe(description)+'</p></div>'+extra+'</header>';
const panelTitle=(name,description,extra='')=>'<div class="panel-title"><div><h2>'+safe(name)+'</h2>'+(description?'<p>'+safe(description)+'</p>':'')+'</div>'+extra+'</div>';
const section=(name,description,body,extra='')=>'<section class="panel">'+panelTitle(name,description,extra)+body+'</section>';
const monthControl=()=>'<div class="periods">'+iconButton('previous-month','Previous month','left')+button('period',monthLabel(month),'calendar')+iconButton('next-month','Next month','chevron')+'</div>';
const progress=(percent,label)=>'<div class="progress '+(percent>100?'over':'')+'" role="progressbar" aria-label="'+safe(label)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(Math.min(100,Math.max(0,percent)))+'"><span style="width:'+Math.min(100,Math.max(0,percent))+'%"></span></div>';
const navLink=([id,name,symbol],mobile=false)=>'<a class="side-link" href="#'+id+'"'+(route()===id?' aria-current="page"':'')+'>'+icon(symbol)+(mobile&&id==='goals'?'Goals':name)+'</a>';
const txIcons={'Food & drink':['coffee','orange'],Shopping:['bag','pink'],Transport:['car','blue'],Housing:['home','blue'],Subscriptions:['subscription','blue'],'Debt payment':['debt','orange']};
const txIcon=item=>blockIcon(...(item.balanceAdjustment?['wallet','blue']:txIcons[item.category]||(item.type==='income'?['up','green']:['down','pink'])));
const txText=item=>'<b class="'+(item.type==='income'?'positive':'')+'">'+safe(signed(item))+'</b>';
const dot=color=>'<i class="dot" style="--dot:'+color+'"></i>';

function reminders() {
 const debts=state.debts.filter(x=>x.due&&outstanding(x)>0).map(x=>({...x,amount:outstanding(x),kind:'debt'}));
 const subscriptions=state.subscriptions.filter(x=>x.due&&x.status==='active').map(x=>({...x,kind:'subscription'}));
 return [...debts,...subscriptions].sort((a,b)=>a.due.localeCompare(b.due));
}
function dueBadge(item) {
 const days=daysAway(item.due);
 if(days<0)return chip(Math.abs(days)+'d overdue','pink');
 if(days===0)return chip('Due today','orange');
 if(days<=item.lead)return chip('In '+days+'d','orange');
 return chip(displayDate(item.due));
}
const calendarButton=(item,kind,label='Download calendar reminder')=>iconButton('calendar',label,'calendar',attr(item)+' data-kind="'+kind+'"');
function reminderRow(item,download=false) {
 const kind=item.kind==='debt'?(item.direction==='owed'?'Debt owed to you':'Debt to pay'):'Subscription';
 return '<div class="list-item">'+blockIcon(item.kind,item.kind==='debt'?'orange':'blue')+'<div class="row-main"><strong>'+safe(item.title)+'</strong><small>'+safe(kind+' · '+original(item))+'</small></div>'+dueBadge(item)+(download?calendarButton(item,item.kind,'Download reminder for '+item.title):'')+'</div>';
}
function recentRow(item) {
 return '<div class="list-item">'+txIcon(item)+'<div class="row-main"><strong>'+safe(item.title)+'</strong><small>'+safe(item.category+' · '+displayDate(item.date))+'</small></div><div class="amount">'+txText(item)+'</div></div>';
}
function cashChart() {
 const period=Array.from({length:6},(_,i)=>shiftMonth(month,i-5));
 const data=period.map(value=>totals(inMonth(value)));
 const max=Math.max(4,...data.flatMap(row=>[row.income,row.expense]));
 const step=10**Math.floor(Math.log10(max/4));
 const ceiling=Math.ceil(max/(step*4))*step*4;
 const pathFor=key=>data.reduce((path,row,i)=>{
  const x=50+i*100, y=170-170*row[key]/ceiling;
  if(!i)return 'M'+x+' '+y;
  const lastY=170-170*data[i-1][key]/ceiling;
  return path+' C'+(x-50)+' '+lastY+' '+(x-50)+' '+y+' '+x+' '+y;
 },'');
 const income=pathFor('income');
 const expense=pathFor('expense');
 const labels=[1,.75,.5,.25,0].map(part=>'<span>'+safe(compact(ceiling*part/state.reportRate))+'</span>').join('');
 const keys=period.map((value,i)=>{
  const info=[monthLabel(value),report(data[i].income),report(data[i].expense)];
  return '<button type="button" class="chart-point" aria-label="'+safe(info[0]+', income '+info[1]+', expenses '+info[2])+'" data-index="'+i+'" data-label="'+safe(info[0])+'" data-income="'+safe(info[1])+'" data-expense="'+safe(info[2])+'"></button>';
 }).join('');
 return section('Cash flow','Income and expenses over six months','<div class="chart-flex"><div class="axis" aria-hidden="true">'+labels+'</div><div><div class="chart-plot"><div class="chart-grid" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#a788ff" stop-opacity=".27"/><stop offset="1" stop-color="#a788ff" stop-opacity=".01"/></linearGradient></defs><path d="'+income+' L550 170 H50 Z" fill="url(#shade)"/><path d="'+income+'" fill="none" stroke="#bba7ff" stroke-width="2.3" vector-effect="non-scaling-stroke"/><path d="'+expense+'" fill="none" stroke="#66d6bc" stroke-width="2.1" vector-effect="non-scaling-stroke"/></svg><div class="chart-points">'+keys+'</div><div class="chart-tooltip" hidden aria-hidden="true"></div></div><div class="x-axis" aria-hidden="true">'+period.map(value=>'<span>'+safe(monthLabel(value,true))+'</span>').join('')+'</div></div></div>','<div class="legend"><span>'+dot('#bba7ff')+'Income</span><span>'+dot('#66d6bc')+'Expenses</span></div>');
}
function spendingChart(list,total) {
 const grouped=new Map();
 operational(list).filter(item=>item.type==='expense').forEach(item=>grouped.set(item.category,(grouped.get(item.category)||0)+base(item)));
 const sorted=[...grouped].filter(([,value])=>value>0).sort((a,b)=>b[1]-a[1]);
 const lead=sorted.slice(0,5);
 if(sorted.length>5)lead.push(['Other categories',sum(sorted.slice(5),entry=>entry[1])]);
 const colors=['#ad94f5','#74dac1','#ffc190','#7a8ee0','#ed9fbd','#999aaf'];
 let end=0;
 const stops=lead.map((item,i)=>{const start=end;end+=item[1]*100/total;return colors[i]+' '+start+'% '+end+'%';});
 return section('Spending breakdown',monthLabel(month),'<div class="spending"><div class="donut" style="background:'+(stops.length?'conic-gradient('+stops.join(',')+')':'#35364a')+'"><div class="donut-center"><b>'+safe(compact(total/state.reportRate))+'</b><small>'+safe(state.currency+' spent')+'</small></div></div><div class="spend-list">'+(lead.map(([label,value],i)=>'<div class="spend-row"><span>'+dot(colors[i])+safe(label)+'</span><b>'+Math.round(value*100/total)+'%</b></div>').join('')||empty('No expenses this month.'))+'</div></div><hr class="panel-divider">'+link('budgets','View budgets'));
}
function overview() {
 const list=inMonth(month);
 const selected=totals(list);
 const balance=cashBalanceThrough(month+'-31');
 const net=selected.income-selected.expense;
 const debt=sum(state.debts.filter(item=>item.direction==='owe'),item=>base({...item,amount:outstanding(item)}));
 const saved=sum(state.goals,item=>base({...item,amount:savings(item)}));
 const metrics=[['Income',selected.income,'up','green'],['Expenses',selected.expense,'down','pink'],['Debt to pay',debt,'debt','orange'],['Goal savings',saved,'goal','blue']];
 return title('Overview','A clear view of where your money stands.',monthControl())+
 '<section class="hero" aria-label="Tracked cash balance"><div class="hero-art" aria-hidden="true"></div><span class="hero-corner">'+safe(state.currency)+'</span>'+
 '<div class="hero-copy"><div class="hero-label">'+icon('wallet')+'Tracked cash balance</div><div class="hero-value">'+safe(report(balance))+'</div><div class="hero-foot">'+chip((net>=0?'+':'')+report(net))+'<span>Cash flow in '+safe(monthLabel(month,true))+'</span>'+button('balance-adjustment',state.transactions.length?'Adjust balance':'Set opening balance','','text-button')+'</div></div></section>'+
 '<div class="metrics">'+metrics.map(([label,value,symbol,tone])=>'<div class="metric">'+blockIcon(symbol,tone)+'<div><small>'+label+'</small><b>'+safe(report(value))+'</b></div></div>').join('')+'</div>'+
 '<div class="split">'+cashChart()+spendingChart(list,selected.expense)+'</div><div class="split">'+
 section('Recent transactions','For '+monthLabel(month),list.sort(dateSort).slice(0,5).map(recentRow).join('')||empty('No transactions this month.'),link('transactions','View all'))+
 section('Upcoming payments','Debt deadlines and renewals',reminders().slice(0,4).map(item=>reminderRow(item)).join('')||empty('Nothing is due.'),button('reminders','View all','','text-button'))+'</div>'+investmentOverview();
}

const optionList=(options,selected)=>options.map(option=>{
 const [value,label]=Array.isArray(option)?option:[option,option];
 return '<option value="'+safe(value)+'"'+(value===selected?' selected':'')+'>'+safe(label)+'</option>';
}).join('');
const filter={query:'',type:'all',period:'month'};
function filteredTransactions() {
 const query=filter.query.trim().toLowerCase();
 return state.transactions.filter(item=>(filter.period==='all'||item.date.startsWith(month))&&(filter.type==='all'||item.type===filter.type)&&(!query||[item.title,item.category,item.account,item.note,item.currency].some(text=>(text||'').toLowerCase().includes(query)))).sort(dateSort);
}
function transactionRows() {
 return filteredTransactions().map(item=>'<div class="list-item transaction-row"><div class="tx-name">'+txIcon(item)+'<div class="row-main"><strong>'+safe(item.title)+'</strong><small>'+safe(item.balanceAdjustment?'Balance correction'+(item.note?' · '+item.note:''):item.account||item.category)+'</small></div></div><span class="cell">'+safe(item.category)+'</span><span class="cell">'+safe(displayDate(item.date))+'</span><div class="amount">'+txText(item)+'<small>'+safe(item.currency===state.currency?displayDate(item.date):'≈ '+report(base(item)))+'</small></div>'+iconButton('transaction','Edit '+item.title,'edit',attr(item))+'</div>').join('')||empty('No transactions match your filters.');
}
function transactions() {
 return title('Transactions','Add and review money coming in and going out.')+
 '<div class="toolbar"><div class="filters"><input id="tx-search" type="search" placeholder="Search transactions" aria-label="Search transactions" value="'+safe(filter.query)+'"><select id="tx-type" aria-label="Transaction type">'+optionList([['all','All types'],['income','Income'],['expense','Expense']],filter.type)+'</select><select id="tx-period" aria-label="Transaction period">'+optionList([['month','Selected month'],['all','All dates']],filter.period)+'</select></div><div class="cluster">'+monthControl()+button('csv','CSV','download')+'</div></div>'+
 '<section class="panel table-panel" aria-label="Transaction list"><div class="transaction-row table-head" aria-hidden="true"><span>Transaction</span><span class="cell">Category</span><span class="cell">Date</span><span class="amount">Amount</span><span></span></div><div id="transaction-list">'+transactionRows()+'</div></section>';
}
function card(item,sub,symbol,tone,body,buttons,badge) {
 return '<article class="panel item-card"><div class="panel-title">'+blockIcon(symbol,tone)+badge+'</div><div><h2>'+safe(item.title)+'</h2><p class="subhead">'+safe(sub)+'</p></div>'+body+'<div class="card-actions">'+buttons+'</div></article>';
}
function cardPage(name,description,kind,draw,extra='') {
 const entries=state[collections[kind]];
 const add=button(kind,'Add '+kind,'plus','btn primary');
 return title(name,description,extra?'<div class="cluster">'+extra+add+'</div>':add)+(entries.length?'<div class="grid-cards">'+entries.map(draw).join('')+'</div>':'<section class="panel">'+empty('No '+name.toLowerCase()+' yet.')+'</section>');
}
const edit=(kind,item)=>button(kind,'Edit','edit','text-button',attr(item)+' aria-label="Edit '+safe(item.title)+'"');
const value=text=>'<div class="item-value">'+safe(text)+'</div>';
const progressLabel=(left,right)=>'<div class="progress-label"><span>'+safe(left)+'</span><span>'+safe(right)+'</span></div>';
function budgets() {
 return cardPage('Budgets','Set monthly category limits and see how much is left.','budget',item=>{
  const spent=sum(inMonth(month).filter(tx=>tx.type==='expense'&&tx.category===item.category),base);
  const limit=base(item);
  const remaining=limit-spent;
  const percent=limit>0?100*spent/limit:0;
  return card(item,monthLabel(month),'budget','blue',value(report(spent))+progress(percent,'Budget used')+
   progressLabel(report(Math.abs(remaining))+(remaining<0?' over':' left'),original(item)+' limit'),edit('budget',item),percent>100?chip('Over budget','orange'):chip(Math.round(percent)+'% used'));
 },monthControl());
}
function debts() {
 return cardPage('Debts','Track what you owe, what others owe you, and every payment.','debt',item=>{
  const balance=outstanding(item), percent=100*(item.amount-balance)/item.amount;
  const owe=item.direction==='owe';
  return card(item,(owe?'You owe':'Owed to you')+' · '+item.source,'debt',owe?'orange':'green',value(money(balance,item.currency))+progress(percent,'Repaid')+progressLabel(Math.round(percent)+'% settled',original(item)+' original'),
   (balance>0?button('payment',owe?'Record payment':'Record receipt','plus','btn primary',attr(item)):'')+
   (balance>0&&item.due?calendarButton(item,'debt'):'')+edit('debt',item),balance===0?chip('Settled','green'):item.due?dueBadge(item):chip('No due date'));
 });
}
function subscriptions() {
 const projected=sum(state.subscriptions.filter(x=>x.status==='active'),item=>base(item)*({weekly:52/12,monthly:1,yearly:1/12})[item.cycle]);
 return cardPage('Subscriptions','Track renewals and recurring costs. Estimated monthly cost: '+report(projected)+'.','subscription',item=>{
  const active=item.status==='active';
  return card(item,cycles[item.cycle]+' · '+(active?'Next '+displayDate(item.due):'Paused'),'subscription','blue',value(original(item)),
   (active?button('renewal','Record renewal','check','btn primary',attr(item))+calendarButton(item,'subscription'):'')+edit('subscription',item),active?dueBadge(item):chip('Paused'));
 });
}
function goals() {
 return cardPage('Savings goals','Set money aside for purchases, an emergency fund or your next milestone.','goal',item=>{
  const saved=savings(item),percent=100*saved/item.amount;
  return card(item,item.due?'Target date · '+displayDate(item.due):'No target date','goal','green',value(money(saved,item.currency))+progress(percent,'Goal funded')+progressLabel(original(item)+' target',percent>=100?'Goal met':money(round(item.amount-saved),item.currency)+' to go'),
   button('contribution','Add savings','plus','btn primary',attr(item))+button('withdrawal','Withdraw','','btn',attr(item)+(saved?'':' disabled'))+edit('goal',item),chip(Math.round(percent)+'%',percent>=100?'green':''));
 });
}

const fxCache = new Map();
async function fetchRate(from,to,date='') {
 if(from===to)return {rate:1,date:date||today()};
 const key=[from,to,date].join('/');
 const cached=fxCache.get(key);
 if(cached&&Date.now()-cached.time<900000)return cached;
 const params=new URLSearchParams({base:from,quotes:to});
 if(date){params.set('from',date);params.set('to',date);}
 const response=await fetch('https://api.frankfurter.dev/v2/rates?'+params,{signal:AbortSignal.timeout(6500)});
 if(!response.ok)throw Error('Rate unavailable');
 const quote=(await response.json()).at(-1);
 if(!quote||!Number.isFinite(quote.rate)||quote.rate<=0)throw Error('Rate unavailable');
 const cachedQuote={rate:quote.rate,date:quote.date,time:Date.now()};
 fxCache.set(key,cachedQuote);
 return cachedQuote;
}
const converter={amount:'1',from:'USD',to:'IDR',manual:'',showManual:false,quote:null,error:''};
let conversionRun=0;
const digits='min="0.000000000001" max="100000000000000" step="any"';
const field=(label,name,val='',type='text',attrs='',style='')=>'<label class="'+style+'">'+safe(label)+'<input name="'+name+'" type="'+type+'" value="'+safe(val)+'" '+attrs+'></label>';
const select=(label,name,options,chosen,attrs='',style='')=>'<label class="'+style+'">'+safe(label)+'<select name="'+name+'" '+attrs+'>'+optionList(options,chosen)+'</select></label>';
const amountField=(label,val='',max=100000000000000)=>field(label,'amount',val,'number','min="0.01" max="'+max+'" step="0.01" inputmode="decimal" required');
const dateField=(label,name,val='',required=false,max='9999-12-31')=>field(label,name,val,'date','min="1900-01-01" max="'+max+'" '+(required?'required':''));
const notesField=val=>'<label class="wide">Notes<textarea name="note" maxlength="2000" placeholder="Optional">'+safe(val)+'</textarea></label>';
const readForm=form=>Object.fromEntries(new FormData(form));
function currencyConverter() {
 return title('Currency converter','Convert between 29 currencies using a dated reference rate or your own rate.')+
 '<section class="panel converter"><form id="converter"><div class="converter-form">'+
 field('Amount','amount',converter.amount,'number','min="0" max="100000000000000" step="any" required')+select('From','from',currencies,converter.from)+
 iconButton('swap','Swap currencies','transaction')+select('To','to',currencies,converter.to)+'</div>'+
 '<div id="conversion-result" class="conversion" aria-live="polite"></div><div class="cluster"><button type="submit" class="btn primary">'+icon('currency')+'Convert</button>'+button('manual','Enter a manual rate')+'</div>'+
 '<div id="manual-rate" class="form-note"'+(converter.showManual?'':' hidden')+'>'+field('Units of target currency per 1 source currency','manual',converter.manual,'number',digits)+'</div></form></section>';
}
function conversionResult() {
 const result=$('#conversion-result');
 if(!result)return;
 if(converter.error){result.innerHTML='<small>Conversion</small><b>Rate unavailable</b><small>'+safe(converter.error)+'</small>';return;}
 const {quote,amount,from,to}=converter;
 if(!quote){result.innerHTML='<small>Conversion</small><b>—</b><small>Convert with the latest reference rate or enter your own.</small>';return;}
 const source=from===to?'Same currency':quote.date?'Frankfurter reference rate · '+displayDate(quote.date):'Manual rate';
 result.innerHTML='<small>'+safe(money(Number(amount),from))+' converts to</small><b>'+safe(money(Number(amount)*quote.rate,to))+'</b><small>'+safe('1 '+from+' = '+quote.rate.toLocaleString('en',{maximumSignificantDigits:9})+' '+to+' · '+source)+'</small>';
}
async function convert(event) {
 const form=event.target, values=readForm(form), run=++conversionRun;
 const submit=event.submitter;
 Object.assign(converter,values,{quote:null,error:''});
 $('#conversion-result').innerHTML='<small>Getting the exchange rate…</small>';
 submit.disabled=true;
 try {
  const quote=values.from===values.to?{rate:1,date:''}:values.manual?{rate:Number(values.manual),date:''}:await fetchRate(values.from,values.to);
  if(run!==conversionRun||!form.isConnected)return;
  if(!(quote.rate>0&&Number.isFinite(quote.rate)))throw Error('Invalid rate');
  converter.quote=quote;
 } catch {
  if(run!==conversionRun||!form.isConnected)return;
  converter.error='Try again or enter a manual exchange rate.';
 } finally {submit.disabled=false;}
 conversionResult();
}
const modal=$('#dialog');
const content={overview,transactions,budgets,debts,subscriptions,goals,currency:currencyConverter,investments};
let lastPage;
function render() {
 const page=route(), mobile=[pages[0],pages[1],pages[3],pages[5]];
 const group=rows=>'<div class="nav-group">'+rows.map(item=>navLink(item)).join('')+'</div>';
 $('#navigation').innerHTML='<p class="nav-label">Workspace</p>'+group([...pages.slice(0,3),pageMap.get('investments')])+'<p class="nav-label">Plan ahead</p>'+group(pages.slice(3,7));
 $('#mobile-nav').innerHTML=mobile.map(item=>navLink(item,true)).join('')+button('more','More','more','side-link',mobile.some(item=>item[0]===page)?'':'aria-current="page"');
 $('#crumb').textContent=pageMap.get(page)[1];
 $('#bell-dot').hidden=!reminders().some(item=>daysAway(item.due)<=item.lead);
 $('#main').innerHTML='<div class="enter">'+content[page]()+'</div>';
 if(page==='currency')conversionResult();
 if(page!==lastPage){scrollTo(0,0);lastPage=page;}
}
let doSubmit;
function openModal(title,html) {
 modal.innerHTML='<div class="dialog-head"><h2 id="dialog-title">'+safe(title)+'</h2>'+iconButton('close','Close dialog','close')+'</div><div class="dialog-body">'+html+'</div>';
 if(!modal.open)modal.showModal();
}
function formModal(title,fields,label,submit,remove='') {
 openModal(title,'<form id="modal-form"><div class="form-grid">'+fields+'</div><p class="error" role="alert" hidden></p><div class="form-actions">'+remove+button('close','Cancel')+'<button type="submit" class="btn primary">'+safe(label)+'</button></div></form>');
 doSubmit=submit;
}
function feedback(message) {
 const error=$('.error',modal);
 if(modal.open&&error){error.textContent=message;error.hidden=false;}
 else toast(message);
}
function confirmAction(title,description,label,submit) {
 formModal(title,'<p class="form-note wide">'+safe(description)+'</p>',label,submit);
}
function balanceAdjustment() {
 const label=state.transactions.length?'Adjust balance':'Set opening balance';
 const fields='<p class="form-note wide">Enter the money you actually have. Folio records the difference in Transactions without counting it as income or spending.</p>'+
  field('Actual balance in '+state.currency,'actual','','number','min="-100000000000000" max="100000000000000" step="0.01" inputmode="decimal" required autofocus')+
  dateField('Effective date','date',today(),true,today())+'<label class="wide">Reason<textarea name="note" maxlength="2000" placeholder="Optional, for example bank correction"></textarea></label>'+
  '<p id="balance-preview" class="form-note wide" aria-live="polite"></p>';
 formModal(label,fields,label,event=>{
  const values=readForm(event.target), actual=Number(values.actual);
  const delta=window.Folio.balance.balanceDelta(state.transactions,values.date,actual,state.reportRate);
  if(!Number.isFinite(actual)||Math.abs(actual)>100000000000000)return feedback('Enter a valid actual balance.');
  if(!values.date)return feedback('Choose an effective date.');
  if(round(Math.abs(delta)*state.reportRate)===0)return feedback('The tracked balance already matches that amount.');
  if(!(Math.abs(delta)<=100000000000000&&Number.isFinite(delta*state.reportRate)))return feedback('The required correction is too large.');
  const opening=state.transactions.length===0;
  update(next=>next.transactions.push({
   id:uid(),title:opening?'Opening balance':'Balance adjustment',amount:Math.abs(delta),currency:state.currency,
   rate:state.reportRate,rateDate:state.reportDate||'',date:values.date,type:delta>0?'income':'expense',
   category:'Balance adjustment',account:'Cash balance',note:(values.note||'').trim(),balanceAdjustment:true
  }),opening?'Opening balance recorded.':'Balance adjusted.');
 });
 const form=$('#modal-form',modal), preview=$('#balance-preview',form);
 const draw=()=>{
  const values=readForm(form), actual=Number(values.actual), tracked=cashBalanceThrough(values.date||today())/state.reportRate;
  if(values.actual===''||!Number.isFinite(actual)){preview.textContent='Current tracked balance: '+report(tracked*state.reportRate)+'.';return;}
  const delta=window.Folio.balance.balanceDelta(state.transactions,values.date||today(),actual,state.reportRate);
  preview.textContent=delta===0?'The tracked balance already matches.':'Folio will record '+(delta>0?'an increase of ':'a decrease of ')+money(Math.abs(delta),state.currency)+'.';
 };
 form.addEventListener('input',draw);draw();
}
function history(items,label,currency) {
 return items?.length?'<section class="wide"><p class="form-note">'+safe(label)+'</p><div class="history">'+items.slice().reverse().map(entry=>'<p><span>'+safe(displayDate(entry.date))+'</span><b>'+safe(money(entry.amount,currency))+'</b></p>').join('')+'</div></section>':'';
}
function recordForm(kind,id) {
 const existing=id?itemBy(kind,id):null;
 if(id&&!existing)return;
 const item=existing||{currency:state.currency,rate:state.reportRate,rateDate:state.reportDate};
 const linked=item.link;
 const fixedCurrency=linked||(kind==='debt'&&item.payments?.length)||(kind==='goal'&&item.contributions?.length);
 let rateDate=item.rateDate||'';
 const nameField=field(kind==='debt'?'Lender, person or debt name':'Name','title',item.title,'text','maxlength="120" required','wide');
 const lead=field('Remind me days before','lead',item.lead??3,'number','min="0" max="365" step="1" required');
 const rateFields='<div id="record-rate" class="wide"'+(item.currency==='IDR'||linked?' hidden':'')+'>'+field('IDR per 1 unit','rate',item.rate,'number',digits)+button('reference','Use reference rate','currency')+'<small class="wide" id="rate-info">'+safe(rateDate?'Reference dated '+displayDate(rateDate):'Enter the exchange rate used for this record.')+'</small></div>';
 const limitLabel=({debt:'Original amount',goal:'Savings target',budget:'Monthly limit'})[kind]||'Amount';
 const moneyFields=amountField(limitLabel,item.amount)+select('Currency','currency',currencies,item.currency,fixedCurrency?'disabled':'')+rateFields;
 const date=(label,required=false)=>dateField(label,'due',item.due,required);
 const account=field('Account or wallet','account',item.account,'text','maxlength="120" placeholder="Bank, cash, e-wallet…"');
 let fields;
 if(kind==='transaction'){
  const type=item.type||'expense';
  const adjustment=item.balanceAdjustment;
  fields=nameField+select(adjustment?'Correction direction':'Type','type',[['expense',adjustment?'Decrease':'Expense'],['income',adjustment?'Increase':'Income']],type,linked?'disabled':'')+
   (adjustment?'<input type="hidden" name="category" value="Balance adjustment"><p class="form-note">Recorded as a balance correction, not income or spending.</p>':select('Category','category',type==='income'?incomeCategories:expenseCategories,item.category,linked?'disabled':''))+moneyFields+
   dateField('Date','date',item.date||today(),true,today())+account+notesField(item.note);
  if(linked)fields+='<p class="form-note wide">'+safe(linked.kind==='debt'?'Amount changes also update the debt balance.':'This renewal is linked to the subscription tracker.')+'</p>';
 }
 if(kind==='debt')fields=nameField+select('Direction','direction',[['owe','I owe'],['owed','Owed to me']],item.direction||'owe',item.payments?.length?'disabled':'')+select('Source','source',sources,item.source||'Person')+moneyFields+date('Due date')+lead+notesField(item.note)+history(item.payments,'Payment history',item.currency);
 if(kind==='subscription')fields=nameField+moneyFields+select('Billing cycle','cycle',Object.entries(cycles),item.cycle||'monthly')+select('Status','status',[['active','Active'],['paused','Paused']],item.status||'active')+date('Next renewal',true)+lead+notesField(item.note);
 if(kind==='goal')fields=nameField+moneyFields+date('Target date')+notesField(item.note)+history(item.contributions,'Savings history',item.currency);
 if(kind==='budget')fields=select('Expense category','category',expenseCategories,item.category,'','wide')+moneyFields+notesField(item.note);
 const removable=existing&&!(kind==='debt'&&item.payments?.some(entry=>entry.txId));
 const remove=removable?button('delete','Delete','','btn danger','data-kind="'+kind+'" '+attr(item)):'';
 const name=(existing?'Edit ':'Add ')+kind;
 formModal(name,fields,existing?'Save changes':'Save '+kind,event=>{
  const values=readForm(event.target);
  const currency=values.currency||item.currency;
  const rate=currency==='IDR'?1:linked?item.rate:Number(values.rate);
  const amount=Number(values.amount);
  if(!(rate>0&&Number.isFinite(rate)&&amount>0&&Number.isFinite(rate*amount)))return feedback('Enter a valid amount and a positive exchange rate.');
  const name=values.title?.trim()||values.category;
  if(!name)return feedback('Enter a name.');
  if(kind==='debt'&&amount<round(sum(item.payments||[],payment=>payment.amount)))return feedback('Original amount must cover payments already recorded.');
  if(kind==='budget'&&state.budgets.some(entry=>entry.category===values.category&&entry.id!==id))return feedback('A budget already exists for this category.');
  if(linked?.kind==='debt'){
   const debt=itemBy('debt',linked.id);
   if(debt&&amount>round(outstanding(debt)+item.amount))return feedback('Amount exceeds the original debt balance.');
  }
  const record={...item,...values,id:id||uid(),title:name,amount,currency,rate,rateDate,note:(values.note||'').trim()};
  if(kind==='transaction')record.account=(values.account||'').trim();
  if(kind==='debt')Object.assign(record,{payments:item.payments||[],lead:Number(values.lead)});
  if(kind==='subscription')Object.assign(record,{lead:Number(values.lead),anchor:item.due===values.due?item.anchor||Number(values.due.slice(-2)):Number(values.due.slice(-2))});
  if(kind==='goal')record.contributions=item.contributions||[];
  update(next=>{
   const list=next[collections[kind]], index=list.findIndex(entry=>entry.id===id);
   if(index<0)list.push(record);else list[index]=record;
   if(linked?.kind==='debt'){
    const payment=itemBy('debt',linked.id,next)?.payments.find(entry=>entry.txId===id);
    if(payment)Object.assign(payment,{amount,date:values.date});
   }
  },existing?'Changes saved.':kind[0].toUpperCase()+kind.slice(1)+' added.');
 },remove);
 const form=$('#modal-form',modal);
 if(kind==='transaction'&&!linked&&!item.balanceAdjustment)form.elements.type.addEventListener('change',()=>{
  form.elements.category.innerHTML=optionList(form.elements.type.value==='income'?incomeCategories:expenseCategories,'');
 });
 if(!linked){
  form.elements.currency.addEventListener('change',()=>{
   const selected=form.elements.currency.value;
   $('#record-rate',form).hidden=selected==='IDR';
   form.elements.rate.value=selected===state.currency?state.reportRate:selected==='IDR'?1:'';
   rateDate=selected===state.currency?state.reportDate:'';
   $('#rate-info',form).textContent='Enter the exchange rate used for this record.';
  });
  form.elements.rate.addEventListener('input',()=>{rateDate='';$('#rate-info',form).textContent='Manual rate';});
  form.addEventListener('folio-rate',event=>{rateDate=event.detail;});
 }
}
async function useReference(button) {
 const form=$('#modal-form',modal), currency=form.elements.currency.value, info=$('#rate-info',form);
 const date=form.elements.date?.value||'';
 button.disabled=true;
 try {
  const quote=await fetchRate(currency,'IDR',date).catch(()=>fetchRate(currency,'IDR'));
  if(!form.isConnected||currency!==form.elements.currency.value)return;
  form.elements.rate.value=quote.rate;
  form.dispatchEvent(new CustomEvent('folio-rate',{detail:quote.date}));
  info.textContent='Frankfurter reference rate · '+displayDate(quote.date);
 } catch {if(form.isConnected)info.textContent='Reference rate unavailable. You can enter your own rate.';}
 finally {button.disabled=false;}
}
function flowForm(type,id) {
 const kind=type==='payment'?'debt':type==='renewal'?'subscription':'goal';
 const item=itemBy(kind,id);
 if(!item)return;
 const withdrawal=type==='withdrawal';
 const limit=type==='payment'?outstanding(item):withdrawal?savings(item):undefined;
 if(limit===0)return;
 const label=type==='payment'?(item.direction==='owe'?'Record payment':'Record receipt'):type==='renewal'?'Record renewal':withdrawal?'Withdraw savings':'Add savings';
 const description=kind==='goal'?'Goal allocations track money set aside. The cash-flow ledger stays the same.':'Folio also adds a transaction to your ledger.';
 formModal(label,'<p class="form-note wide">'+safe(item.title+' · '+item.currency+'. '+description)+'</p>'+
  amountField('Amount',type==='renewal'?item.amount:limit??'',limit)+dateField('Date','date',today(),true,today())+
  (kind==='goal'?'':field('Account or wallet','account','','text','maxlength="120" placeholder="Optional"','wide')),label,event=>{
  const values=readForm(event.target), amount=Number(values.amount), current=itemBy(kind,id);
  if(!current)return feedback('This record is no longer available.');
  const available=kind==='debt'?outstanding(current):withdrawal?savings(current):Infinity;
  if(!(amount>0&&amount<=available))return feedback('Enter an amount within the remaining balance.');
  update(next=>{
   const record=itemBy(kind,id,next);
   if(kind==='goal'){record.contributions.push({amount:withdrawal?-amount:amount,date:values.date});return;}
   const receipt=kind==='debt'&&record.direction==='owed';
   const tx={id:uid(),title:record.title,amount,currency:record.currency,rate:record.rate,rateDate:record.rateDate||'',date:values.date,type:receipt?'income':'expense',category:kind==='subscription'?'Subscriptions':receipt?'Debt repayment':'Debt payment',account:(values.account||'').trim(),note:'',link:{kind,id}};
   if(kind==='debt')record.payments.push({amount,date:values.date,txId:tx.id});
   else {
    tx.link.renewalFrom=record.due;tx.link.renewalTo=nextRenewal(record);
    record.due=tx.link.renewalTo;
   }
   next.transactions.push(tx);
  },'Saved.');
 });
}
function removeRecord(kind,id) {
 const item=itemBy(kind,id);
 if(!item)return;
 const renewal=item.link?.kind==='subscription';
 const payment=item.link?.kind==='debt';
 const detail=payment?' The linked payment will also be removed.':renewal?' Folio will roll back the next renewal date if this was the latest recorded renewal.':'';
 confirmAction('Delete '+kind,'Remove “'+item.title+'” from Folio?'+detail,'Delete',()=>{
  update(next=>{
   next[collections[kind]]=next[collections[kind]].filter(record=>record.id!==id);
   if(payment){
    const debt=itemBy('debt',item.link.id,next);
    if(debt)debt.payments=debt.payments.filter(entry=>entry.txId!==id);
   }
   if(renewal){
    const sub=itemBy('subscription',item.link.id,next);
    if(sub&&item.link.renewalFrom&&sub.due===item.link.renewalTo)sub.due=item.link.renewalFrom;
   }
  },'Deleted.');
 });
}

function download(filename,text,type) {
 const object=URL.createObjectURL(new Blob([text],{type}));
 const anchor=Object.assign(document.createElement('a'),{href:object,download:filename});
 document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(object),1000);
}
function exportCSV() {
 const headings=['date','name','type','category','amount','currency','IDR per unit','rate date','IDR equivalent','account','notes'];
 const rows=filteredTransactions().map(item=>[item.date,item.title,item.type,item.category,item.amount,item.currency,item.rate,item.rateDate,base(item),item.account,item.note]);
 const csvCell=value=>{
  let text=String(value??'');
  if(typeof value==='string'&&/^\s*[=+\-@]/.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
 };
 download('folio-transactions-'+(filter.period==='all'?'all':month)+'.csv','\uFEFF'+[headings,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
 toast('Transaction CSV downloaded.');
}
const escapeCalendar=value=>String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,char=>'\\'+char);
function foldCalendar(line) {
 const encoder=new TextEncoder(), rows=[];
 let row='', length=0;
 for(const char of line){
  const size=encoder.encode(char).length;
  if(length+size>73){rows.push(row);row=' ';length=1;}
  row+=char;length+=size;
 }
 return [...rows,row].join('\r\n');
}
function exportCalendar(kind,id) {
 const item=reminders().find(x=>x.kind===kind&&x.id===id);
 if(!item)return;
 const summary=(kind==='debt'?'Debt due: ':'Subscription renewal: ')+item.title;
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
 const date=item.due.replaceAll('-','');
 const trigger=item.lead?'-P'+item.lead+'D':'PT0M';
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Folio//Money Planner//EN','BEGIN:VEVENT','UID:'+item.id+'-'+date+'@folio','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+date,'SUMMARY:'+escapeCalendar(summary),'DESCRIPTION:'+escapeCalendar(original(item)),'BEGIN:VALARM','TRIGGER:'+trigger,'ACTION:DISPLAY','DESCRIPTION:'+escapeCalendar(summary),'END:VALARM','END:VEVENT','END:VCALENDAR'];
 download('folio-reminder-'+item.due+'.ics',lines.map(foldCalendar).join('\r\n')+'\r\n','text/calendar;charset=utf-8');
 toast('Import the downloaded event into your calendar to set the alert.');
}
function remindersModal() {
 openModal('Reminders','<p class="form-note">Download a deadline and import it into your calendar to get an alert when Folio is closed.</p>'+
  (reminders().map(item=>reminderRow(item,true)).join('')||empty('No upcoming deadlines.')));
}
function settings() {
 openModal('Settings','<section class="settings-block"><h3>Reporting currency</h3><p class="form-note">Dashboard totals use this currency. Each record keeps its original amount and exchange rate.</p><form id="settings-currency" class="form-grid">'+
 select('Currency','currency',currencies,state.currency)+field('IDR per 1 unit (optional)','manual',state.currency==='IDR'?'':state.reportRate,'number',digits)+
 '<p class="wide form-note">Leave the rate blank to use the latest Frankfurter reference rate.</p><button type="submit" class="btn primary wide">Save reporting currency</button><p class="error wide" hidden role="alert"></p></form></section>'+
 '<section class="settings-block"><h3>Cash balance</h3><p class="form-note">Folio currently tracks '+safe(report(cashBalanceThrough(today())))+'. Corrections appear in Transactions.</p>'+button('balance-adjustment',state.transactions.length?'Adjust balance':'Set opening balance','wallet')+'</section>'+
 '<section class="settings-block"><h3>Data and backups</h3><p class="form-note">Your records are saved to this Folio account. Export a backup any time.</p><div class="cluster">'+button('backup','Export backup','download')+button('restore','Import backup')+(legacyWorkspace()?button('legacy-import','Import old browser records'):'')+'</div></section>'+
 '<section class="settings-block"><h3>Account</h3><p class="form-note">Manage your password, passkeys, and sign-in session.</p>'+button('security','Security','settings')+'</section>');
 const form=$('#settings-currency',modal);
 form.elements.currency.addEventListener('change',event=>{form.elements.manual.value=event.target.value===state.currency&&state.currency!=='IDR'?state.reportRate:'';});
}
async function setReporting(event) {
 const form=event.target, {currency,manual}=readForm(form);
 const submit=event.submitter;
 submit.disabled=true;
 try {
  const quote=currency==='IDR'?{rate:1,date:''}:manual?{rate:Number(manual),date:''}:await fetchRate(currency,'IDR');
  if(!form.isConnected||!modal.open)return;
  if(!(quote.rate>0&&Number.isFinite(quote.rate)))return feedback('Enter a positive exchange rate.');
  update(next=>Object.assign(next,{currency,reportRate:quote.rate,reportDate:quote.date}),'Reporting currency saved.');
 } catch {if(form.isConnected&&modal.open)feedback('Reference rate unavailable. Enter a manual rate and try again.');}
 finally {submit.disabled=false;}
}

const validAmount=value=>Number.isFinite(value)&&value>0&&value<=100000000000000;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&ymd(parseDate(value))===value;
const validText=value=>typeof value==='string'&&value.length<=2000;
const validLead=value=>Number.isInteger(value)&&value>=0&&value<=365;
const validRow=item=>item&&validText(item.id)&&item.id.length>0&&validText(item.title)&&item.title.length>0&&validText(item.note)&&currencies.includes(item.currency)&&validAmount(item.amount)&&validAmount(item.rate);
function validBackup(db) {
 if(!db||db.version!==1||db.demo!==false||!currencies.includes(db.currency)||!validAmount(db.reportRate)||(db.reportDate&&!validDate(db.reportDate)))return false;
 if(!Object.values(collections).every(group=>Array.isArray(db[group])&&db[group].length<=20000&&db[group].every(validRow)&&new Set(db[group].map(row=>row.id)).size===db[group].length))return false;
 return db.transactions.every(x=>validDate(x.date)&&['income','expense'].includes(x.type)&&(x.balanceAdjustment===true?x.category==='Balance adjustment':x.balanceAdjustment===undefined&&allCategories.includes(x.category))&&validText(x.account)&&
   (!x.link||(['debt','subscription'].includes(x.link.kind)&&validText(x.link.id)&&(!x.link.renewalFrom||validDate(x.link.renewalFrom))&&(!x.link.renewalTo||validDate(x.link.renewalTo)))))&&
  db.debts.every(x=>['owe','owed'].includes(x.direction)&&sources.includes(x.source)&&(!x.due||validDate(x.due))&&validLead(x.lead)&&
   Array.isArray(x.payments)&&x.payments.every(entry=>validAmount(entry?.amount)&&validDate(entry.date)&&(!entry.txId||validText(entry.txId)))&&round(sum(x.payments,entry=>entry.amount))<=x.amount)&&
  db.subscriptions.every(x=>validDate(x.due)&&Object.hasOwn(cycles,x.cycle)&&['active','paused'].includes(x.status)&&validLead(x.lead)&&(!x.anchor||(Number.isInteger(x.anchor)&&x.anchor>=1&&x.anchor<=31)))&&
  db.goals.every(x=>(!x.due||validDate(x.due))&&Array.isArray(x.contributions)&&x.contributions.every(entry=>Number.isFinite(entry?.amount)&&validAmount(Math.abs(entry.amount))&&validDate(entry.date))&&savings(x)>=0)&&
  db.budgets.every(x=>expenseCategories.includes(x.category))&&validInvestments(db.investments);
}
async function importBackup(event) {
 const file=event.target.files[0];event.target.value='';
 if(!file)return;
 try {
  if(file.size>8*1024*1024)throw Error('File too large');
  const next=JSON.parse(await file.text());
  if(!validBackup(next))throw Error('Invalid backup');
  next.investments??=[];
  confirmAction('Restore this backup?','This replaces your current workspace with the records in '+file.name+'.','Restore backup',()=>save(next,'Backup restored.',true));
 } catch {feedback('This file is not a valid Folio backup.');}
}
function legacyWorkspace() {
 try {
  const legacy=JSON.parse(localStorage.getItem(storageKey));
  if(!validBackup(legacy))return null;
  legacy.investments??=[];
  const hasEntries=Object.values(collections).some(group=>legacy[group].length)||legacy.investments.length;
  return hasEntries?legacy:null;
 }catch{return null;}
}
function importLegacy() {
 const legacy=legacyWorkspace();
 if(!legacy){feedback('No saved browser records were found.');return;}
 const alreadyUsed=Object.values(collections).some(group=>state[group].length)||(state.investments?.length??0);
 if(alreadyUsed){feedback('Export a backup first. Old browser records can only be imported into an empty workspace.');return;}
 confirmAction('Import old browser records?','Copy records from this browser into your signed-in Folio account.','Import records',()=>save(legacy,'Browser records imported.',true));
}
function monthDialog() {
 formModal('Choose month',field('Month','month',month,'month','required min="1900-06" max="9999-12"','wide'),'Apply',event=>{
  month=readForm(event.target).month;modal.close();render();
 });
}
function showPoint(point) {
 const plot=point.closest('.chart-plot'), tip=$('.chart-tooltip',plot);
 tip.innerHTML='<b>'+safe(point.dataset.label)+'</b><br>Income '+safe(point.dataset.income)+'<br>Expenses '+safe(point.dataset.expense);
 tip.hidden=false;
 const half=tip.offsetWidth/2+2;
 tip.style.left=Math.max(half,Math.min(plot.clientWidth-half,plot.clientWidth*(Number(point.dataset.index)+.5)/6))+'px';
}
function hidePoint(event) {
 if(event.target.matches('.chart-point'))$('.chart-tooltip').hidden=true;
}
const chartTarget=event=>event.target.closest('.chart-point');
document.addEventListener('focusin',event=>{const point=chartTarget(event);if(point)showPoint(point);});
document.addEventListener('focusout',hidePoint);
document.addEventListener('pointerover',event=>{const point=chartTarget(event);if(point&&event.pointerType!=='touch')showPoint(point);});
document.addEventListener('pointerout',event=>{if(event.target!==document.activeElement)hidePoint(event);});
window.addEventListener('hashchange',()=>{if(modal.open)modal.close();render();$('#main').focus({preventScroll:true});});
$('#import-file').addEventListener('change',importBackup);
document.querySelectorAll('[data-icon]').forEach(element=>{element.innerHTML=icon(element.dataset.icon);});
function invalidateConversion(form) {
 conversionRun++;
 Object.assign(converter,readForm(form),{quote:null,error:''});
 conversionResult();
}
document.addEventListener('input',event=>{
 if(event.target.id==='tx-search'){filter.query=event.target.value;$('#transaction-list').innerHTML=transactionRows();}
 const form=event.target.closest('#converter');
 if(form)invalidateConversion(form);
});
document.addEventListener('change',event=>{
 if(event.target.name==='investment-filter'){investmentFilter=event.target.value;render();$('#main select[name=investment-filter]')?.focus({preventScroll:true});return;}
 const key={'tx-type':'type','tx-period':'period'}[event.target.id];
 if(key){filter[key]=event.target.value;$('#transaction-list').innerHTML=transactionRows();}
});
document.addEventListener('submit',event=>{
 switch(event.target.id){
  case 'modal-form':event.preventDefault();doSubmit?.(event);break;
  case 'settings-currency':event.preventDefault();void setReporting(event);break;
  case 'converter':event.preventDefault();void convert(event);break;
 }
});
document.addEventListener('click',event=>{
 const point=chartTarget(event);
 if(point){showPoint(point);return;}
 const target=event.target.closest('[data-action]');
 if(!target)return;
 const {action,id,kind}=target.dataset;
 if(Object.hasOwn(collections,action)){recordForm(action,id);return;}
 if(handleInvestmentAction(action,id,target))return;
 switch(action){
  case 'payment':case 'renewal':case 'contribution':case 'withdrawal':flowForm(action,id);break;
  case 'calendar':exportCalendar(kind,id);break;
  case 'csv':exportCSV();break;
  case 'reference':void useReference(target);break;
  case 'previous-month':if(month>'1900-06'){month=shiftMonth(month,-1);render();}break;
  case 'next-month':if(month<'9999-12'){month=shiftMonth(month,1);render();}break;
  case 'period':monthDialog();break;
  case 'reminders':remindersModal();break;
  case 'settings':settings();break;
  case 'balance-adjustment':balanceAdjustment();break;
  case 'more':openModal('More','<nav aria-label="More pages"><div class="nav-group">'+[pageMap.get('investments'),pages[2],pages[4],pages[6]].map(item=>navLink(item)).join('')+'</div>'+button('settings','Settings','settings','side-link')+'</nav>');break;
  case 'close':modal.close();break;
  case 'delete':removeRecord(kind,id);break;
  case 'legacy-import':importLegacy();break;
  case 'security':void window.Folio.openSecurity();break;
  case 'backup':download('folio-backup-'+today()+'.json',JSON.stringify(state,null,2),'application/json');toast('Backup downloaded.');break;
  case 'restore':$('#import-file').click();break;
  case 'manual':{
   const group=$('#manual-rate');
   converter.showManual=!converter.showManual;
   group.hidden=!converter.showManual;
   if(converter.showManual)$('input',group).focus();
   else {$('input',group).value='';invalidateConversion($('#converter'));}
   break;
  }
  case 'swap':{
   const form=$('#converter');
   const {from,to,manual}=form.elements;
   [from.value,to.value]=[to.value,from.value];
   if(Number(manual.value)>0)manual.value=String(1/Number(manual.value));
   invalidateConversion(form);
   break;
  }
 }
});

render();
