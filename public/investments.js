/*
 * Investments page: holdings with buy, sell and income activity, cost basis, realized and unrealized
 * gains, payouts and allocation. Loaded before app.js, which calls into it.
 */
'use strict';

const investmentKinds = [
 ['stock','Stocks'],['etf','ETFs'],['fund','Reksa dana / mutual funds'],['bond','Bonds / SBN'],
 ['deposit','Term deposits'],['metal','Gold / precious metals'],['crypto','Crypto'],['property','Real estate'],
 ['reit','REITs'],['private','Private equity / business'],['pension','Pension funds'],['collectible','Collectibles'],['other','Other']
];
const investmentKindLabel = new Map(investmentKinds);
const investmentEvents = [['buy','Buy / add position'],['sell','Sell / redeem'],['income','Dividend / interest / distribution']];
const quantityScale = 1e12;
const quantityRound = amount => Math.round(amount * quantityScale) / quantityScale;
const quantityLabel = amount => amount.toLocaleString('en-GB',{maximumFractionDigits:12});
const unitsLabel = amount => quantityLabel(amount)+' '+(amount===1?'unit':'units');
const investmentHoldings = () => state.investments ?? [];
const holdingBy = (id,db=state) => db.investments?.find(holding => holding.id===id);

const activityOrder = (a,b) => a.date.localeCompare(b.date);
function investmentStats(holding) {
 let units=0, cost=0, realized=0, income=0;
 for(const event of holding.activity.slice().sort(activityOrder)){
  if(event.type==='income'){income+=(event.price-event.fee)*event.rate;continue;}
  const gross=event.quantity*event.price;
  if(event.type==='buy'){
   units=quantityRound(units+event.quantity);
   cost+=(gross+event.fee)*event.rate;
   continue;
  }
  if(event.quantity>units)return null;
  const soldCost=cost*event.quantity/units;
  realized+=(gross-event.fee)*event.rate-soldCost;
  units=quantityRound(units-event.quantity);
  cost=units?cost-soldCost:0;
 }
 const market=units?(holding.mark?units*holding.mark.price*holding.mark.rate:null):0;
 return {units,cost,market,realized,income,unrealized:market===null?null:market-cost};
}
function portfolio() {
 const rows=investmentHoldings().map(holding=>({holding,...investmentStats(holding)}));
 const priced=rows.filter(row=>row.units>0&&row.market!==null);
 const unpriced=rows.filter(row=>row.units>0&&row.market===null).length;
 return {
  rows,priced,unpriced, market:sum(priced,row=>row.market), cost:sum(rows,row=>row.cost),
  realized:sum(rows,row=>row.realized), income:sum(rows,row=>row.income),
  unrealized:sum(priced,row=>row.unrealized)
 };
}
const investmentDelta = amount => (amount>0?'+':'')+report(amount);
const investmentTone = amount => amount>0?'positive':amount<0?'invest-negative':'';
const investmentMetric = (label,value,caption,tone='') => '<div class="panel invest-metric"><small>'+safe(label)+'</small><strong class="'+tone+'">'+safe(value)+'</strong><small>'+safe(caption)+'</small></div>';
const makeTrade = holding => button('investment-event','Record activity','plus','btn primary',attr(holding));
const makePrice = holding => button('investment-price','Update value','','btn',attr(holding));
function investmentOverview() {
 const totals=portfolio();
 if(!totals.rows.length)return '';
 return '<div class="invest-overview">'+section('Investments','Latest recorded portfolio prices','<div class="invest-overview-values"><div><small>Recorded market value</small><strong>'+safe(totals.priced.length||!totals.unpriced?report(totals.market):'—')+'</strong></div><div><small>Open holdings</small><strong>'+totals.rows.filter(row=>row.units>0).length+'</strong></div>'+
 (totals.unpriced?'<div><small>Without a price</small><strong>'+totals.unpriced+'</strong></div>':'')+'</div>',link('investments','View portfolio'))+'</div>';
}
function allocationPanel(stats) {
 const weights=new Map();
 for(const row of stats.priced){
  if(row.market>0)weights.set(row.holding.kind,(weights.get(row.holding.kind)??0)+row.market);
 }
 const ranked=[...weights].sort((a,b)=>b[1]-a[1]);
 const palette=['#ad94f5','#74dac1','#ffc190','#8296ef','#ed9fbd','#cbbd86','#66afb1'];
 const bars=ranked.map(([kind,market],i)=>{
  const percent=100*market/stats.market;
  return '<div class="allocation-segment" style="--segment:'+palette[i%palette.length]+';flex-grow:'+percent+'"></div>';
 }).join('');
 const rows=ranked.map(([kind,market],i)=>'<div class="allocation-row"><span>'+dot(palette[i%palette.length])+safe(investmentKindLabel.get(kind))+'</span><b>'+safe(report(market))+'</b><small>'+Math.round(100*market/stats.market)+'%</small></div>').join('');
 return section('Asset allocation','By market value of priced holdings',bars?'<div class="allocation-bar" aria-hidden="true">'+bars+'</div><div class="allocation-list">'+rows+'</div>':empty('Record a positive market value to see your allocation.'));
}
let investmentFilter='all';
function investments() {
 const stats=portfolio();
 const add=button('investment-add','Add holding','plus','btn primary');
 const heading=title('Investments','Track positions, payouts, and returns across asset classes.',add);
 if(!stats.rows.length){
  return heading+'<section class="panel invest-empty">'+blockIcon('investment')+'<h2>Your portfolio is empty</h2><p>Add a holding, then record an opening position or your first purchase.</p></section>';
 }
 const subtitle=stats.unpriced?stats.unpriced+' open '+(stats.unpriced===1?'holding has':'holdings have')+' no price':'At the latest recorded prices';
 const active=stats.rows.filter(row=>row.units>0);
 const pricedDisplay=stats.priced.length||!stats.unpriced?report(stats.market):'—';
 const metrics='<div class="investment-metrics">'+investmentMetric('Recorded market value',pricedDisplay,subtitle)+
  investmentMetric('Open cost basis',report(stats.cost),active.length+' open '+(active.length===1?'holding':'holdings'))+
  investmentMetric('Unrealized gain / loss',stats.priced.length?investmentDelta(stats.unrealized):'—','Priced open positions',investmentTone(stats.unrealized))+
  investmentMetric('Realized gain / loss',investmentDelta(stats.realized),'Net distributions '+report(stats.income),investmentTone(stats.realized))+'</div>';
 if(investmentFilter!=='all'&&!stats.rows.some(row=>row.holding.kind===investmentFilter))investmentFilter='all';
 const facet=select('Asset class','investment-filter',[['all','All assets'],...investmentKinds.filter(([kind])=>stats.rows.some(row=>row.holding.kind===kind))],investmentFilter);
 const display=stats.rows.filter(row=>investmentFilter==='all'||row.holding.kind===investmentFilter);
 const cards=display.length?'<div class="grid-cards">'+display.map(investmentCard).join('')+'</div>':empty('No holdings in this asset class.');
 const header='<div class="invest-holdings-header"><div><h2>Holdings</h2><p>Prices and NAVs are entered manually.</p></div>'+facet+'</div>';
 return heading+metrics+allocationPanel(stats)+header+cards;
}
function investmentCard(row) {
 const {holding,units,market,unrealized,cost}=row;
 const name=holding.symbol?holding.name+' · '+holding.symbol:holding.name;
 const backupTag=!holding.activity.some(event=>event.type==='buy')?'No position recorded':units===0?'Closed':holding.mark?'Price '+displayDate(holding.mark.date):'Needs a price';
 const valueLine=market===null?'—':report(market);
 const markDetail=holding.mark&&units>0&&holding.currency!==state.currency?' · '+money(units*holding.mark.price,holding.currency):'';
 return '<article class="panel item-card investment-card"><div class="panel-title">'+blockIcon('investment','blue')+chip(backupTag,market===null?'orange':'')+'</div>'+
  '<div><h2>'+safe(name)+'</h2><p class="subhead">'+safe(investmentKindLabel.get(holding.kind)+(holding.account?' · '+holding.account:''))+'</p></div>'+
  value(valueLine)+'<p class="invest-units">'+safe(unitsLabel(units)+markDetail)+'</p>'+
  '<div class="progress-label"><span>Open cost '+safe(report(cost))+'</span><b class="'+investmentTone(unrealized)+'">'+safe(unrealized===null?'No valuation':investmentDelta(unrealized))+'</b></div>'+
  '<div class="card-actions">'+makeTrade(holding)+makePrice(holding)+button('investment-detail','Details','chevron','text-button',attr(holding))+'</div></article>';
}
function investmentRegister(id) {
 const item=holdingBy(id);
 const record=item??{name:'',symbol:'',account:'',kind:'stock',currency:state.currency,activity:[],mark:null,categoryId:'',groupId:''};
 const locked=record.activity.length>0||Boolean(record.mark);
 const form=field('Holding name','name',record.name,'text','maxlength="120" required placeholder="e.g. IDX equity fund"','wide')+
  select('Asset class','kind',investmentKinds,record.kind)+select('Currency','currency',currencies,record.currency,locked?'disabled':'')+
  assignmentFields(investmentCategoryTypes,record.categoryId,record.groupId)+
  field('Ticker or reference','symbol',record.symbol,'text','maxlength="32" placeholder="Optional"')+
  field('Broker or account','account',record.account,'text','maxlength="120" placeholder="Optional when no subcategory"','');
 const remove=item?button('investment-remove','Delete holding','','btn danger',attr(item)):'';
 formModal(item?'Edit holding':'Add holding',form,item?'Save changes':'Save holding',async event=>{
  const data=readForm(event.target);
  const name=data.name.trim();
  if(!name)return feedback('Enter a holding name.');
  const current=holdingBy(id);
  if(id&&!current)return feedback('This holding was removed.');
  const category=categoryBy(data.categoryId), group=assetGroupBy(data.groupId);
  if(group&&group.categoryId!==category?.id)return feedback('Choose a subcategory inside the selected category.');
  const kind=category?.type==='crypto'||category?.type==='stock'?category.type:data.kind;
  const saved={...record,...current,...data,id:id||uid(),name,kind,symbol:data.symbol.trim(),account:group?.name||data.account.trim(),
   ...(category?{categoryId:category.id}:{categoryId:undefined}),...(group?{groupId:group.id}:{groupId:undefined})};
  if(current&&(current.activity.length||current.mark))saved.currency=current.currency;
  const savedSuccessfully=await update(db=>{
   db.investments??=[];
   const index=db.investments.findIndex(holding=>holding.id===id);
   if(index<0)db.investments.push(saved);
   else db.investments[index]=saved;
  },item?'Holding updated.':'Holding added.');
  if(savedSuccessfully&&!item&&!modal.open)investmentActivity(saved.id);
 },remove);
 const element=$('#modal-form',modal);
 adaptAssignment(element,investmentCategoryTypes);
 element.elements.categoryId.addEventListener('change',event=>{
  const category=categoryBy(event.target.value);
  if(category?.type==='crypto'||category?.type==='stock')element.elements.kind.value=category.type;
 });
}
const investmentRateInput = (currency,rate) => currency==='IDR'?'':'<div class="invest-rate wide">'+
 field('IDR per 1 '+currency,'rate',rate,'number',digits+' required')+button('investment-rate','Use reference rate','currency','btn','data-currency="'+safe(currency)+'"')+
 '<small class="wide" id="investment-rate-info">Use the rate from your statement, or fetch the reference rate.</small></div>';
function investmentNumber(label,name,val='',attrs='') {
 return field(label,name,val,'number',attrs+' max="100000000000000" step="any" inputmode="decimal" required');
}
function investmentPrice(id) {
 const holding=holdingBy(id);
 if(!holding)return;
 const mark=holding.mark;
 const fields='<p class="form-note wide">'+safe(holding.name+' · '+holding.currency)+'. Enter either a unit price or the whole position value in '+state.currency+'.</p>'+
  select('Value input','valueMode',[['unit','Price or NAV per unit'],['total','Total position value in '+state.currency]],'unit','','wide')+
  investmentNumber('Price or NAV per unit','price',mark?.price??'','min="0"')+
  dateField('Valuation date','date',mark?.date||today(),true,today())+investmentRateInput(holding.currency,mark?.rate??'');
 formModal('Update holding value',fields,'Save valuation',event=>{
  const data=readForm(event.target);
  const input=Number(data.price),rate=holding.currency==='IDR'?1:Number(data.rate),units=investmentStats(holding).units;
  const price=data.valueMode==='total'&&units>0?input*state.reportRate/(units*rate):input;
  if(data.valueMode==='total'&&!(units>0))return feedback('Record a position before entering its total value.');
  if(!investmentValue(price,true)||!investmentValue(rate))return feedback('Enter a valid valuation and exchange rate.');
  const latest=holdingBy(id);
  if(!latest||latest.currency!==holding.currency)return feedback('This holding changed. Reopen it to continue.');
  update(db=>{holdingBy(id,db).mark={price,rate,date:data.date};},'Valuation saved.');
 },mark?button('investment-clear-price','Clear valuation','','btn danger',attr(holding)):'');
 const form=$('#modal-form',modal), input=form.elements.price;
 const adapt=()=>{input.closest('label').firstChild.textContent=form.elements.valueMode.value==='total'?'Total position value in '+state.currency:'Price or NAV per unit';};
 form.elements.valueMode.addEventListener('change',adapt);adapt();
}

function investmentActivity(id,eventId) {
 const holding=holdingBy(id);
 if(!holding)return;
 const entry=holding.activity.find(item=>item.id===eventId);
 const activity=entry??{type:'buy',date:today(),quantity:'',price:'',fee:0,rate:'',note:''};
 const opening=!entry&&!holding.activity.length;
 const fields='<p class="form-note wide">'+safe(holding.name+' · '+holding.currency)+'. Record asset quantity and price, or start with the whole position value in '+state.currency+'.</p>'+
  (opening?select('Opening input','inputMode',[['units','Asset quantity and unit price'],['value','Total position value in '+state.currency]],'units','','wide'):'')+
  select('Activity','type',investmentEvents,activity.type)+dateField('Date','date',activity.date,true,today())+
  investmentNumber('Units','quantity',activity.quantity,'min="0.000000000001"')+
  investmentNumber('Price per unit','price',activity.price,'min="0"')+
  investmentNumber('Fees or withholding','fee',activity.fee,'min="0"')+
  investmentRateInput(holding.currency,activity.rate)+
  notesField(activity.note);
 const remove=entry?button('investment-remove-event','Delete activity','','btn danger',attr(holding)+' data-event="'+safe(entry.id)+'"'):'';
 formModal(entry?'Edit investment activity':'Record investment activity',fields,entry?'Save changes':'Save activity',event=>{
  const data=readForm(event.target);
  const direct=opening&&data.inputMode==='value', type=direct?'buy':data.type, isIncome=type==='income';
  const quantity=isIncome?0:direct?1:quantityRound(Number(data.quantity));
  const rate=holding.currency==='IDR'?1:Number(data.rate);
  const entered=Number(data.price), price=direct?entered*state.reportRate/rate:entered, fee=direct?0:Number(data.fee);
  if(!investmentValue(price,type!=='income')||!investmentValue(fee,true)||!investmentValue(rate)||(!isIncome&&!investmentValue(quantity)))return feedback('Enter valid amounts, units and exchange rate.');
  const recorded={id:entry?.id??uid(),type,date:data.date,quantity,price,fee,rate,note:data.note.trim()};
  const latest=holdingBy(id);
  if(!latest||latest.currency!==holding.currency||(entry&&!latest.activity.some(row=>row.id===entry.id)))return feedback('This holding changed. Reopen it to continue.');
  const list=entry?latest.activity.map(row=>row.id===entry.id?recorded:row):[...latest.activity,recorded];
  if(!investmentStats({...latest,activity:list}))return feedback('A sale exceeds the units held on its trade date. Check the dates and quantities.');
  update(db=>{
   const saved=holdingBy(id,db);
   saved.activity=list;
   if(direct)saved.mark={price,rate,date:data.date};
  },entry?'Activity updated.':direct?'Position value recorded.':'Activity recorded.');
 },remove);
 const form=$('#modal-form',modal);
 const adapt=()=>{
  const direct=opening&&form.elements.inputMode.value==='value', income=form.elements.type.value==='income';
  form.elements.type.closest('label').hidden=direct;
  form.elements.type.disabled=direct;
  form.elements.quantity.closest('label').hidden=income||direct;
  form.elements.quantity.disabled=income||direct;
  form.elements.fee.closest('label').hidden=direct;
  form.elements.fee.disabled=direct;
  form.elements.price.closest('label').firstChild.textContent=direct?'Total position value in '+state.currency:income?'Gross cash received':'Price per unit';
  form.elements.price.min=income?'0.000000000001':'0';
 };
 form.elements.type.addEventListener('change',adapt);
 if(opening)form.elements.inputMode.addEventListener('change',adapt);
 adapt();
}
async function useInvestmentRate(target) {
 const form=$('#modal-form',modal);
 const currency=target.dataset.currency;
 const info=$('#investment-rate-info',form);
 const date=form.elements.date.value;
 target.disabled=true;
 try{
  const quote=await fetchRate(currency,'IDR',date).catch(()=>fetchRate(currency,'IDR'));
  if(!form.isConnected||!modal.open)return;
  form.elements.rate.value=quote.rate;
  info.textContent='Frankfurter reference rate · '+displayDate(quote.date);
 }catch{
  if(form.isConnected&&modal.open)info.textContent='Reference rate unavailable. Enter your own rate.';
 }finally{target.disabled=false;}
}
function investmentDetails(id) {
 const holding=holdingBy(id);
 if(!holding)return;
 const stats=investmentStats(holding);
 const rows=holding.activity.slice().sort(activityOrder).reverse().map(entry=>{
  const label=entry.type==='buy'?'Buy':entry.type==='sell'?'Sell':'Distribution';
  const gross=entry.type==='income'?entry.price:entry.quantity*entry.price;
  const detail=(entry.quantity?quantityLabel(entry.quantity)+' units · ':'')+displayDate(entry.date)+(entry.fee?' · Fee '+money(entry.fee,holding.currency):'');
  return '<div class="list-item"><div class="row-main"><strong>'+label+'</strong><small>'+safe(detail)+'</small>'+(entry.note?'<small>'+safe(entry.note)+'</small>':'')+'</div><div class="amount">'+safe(money(gross,holding.currency))+'</div>'+
   iconButton('investment-event','Edit '+label.toLowerCase()+' on '+displayDate(entry.date),'edit',attr(holding)+' data-event="'+safe(entry.id)+'"')+'</div>';
 }).join('');
 const label=(left,right)=>'<span>'+safe(left)+'</span><strong>'+safe(right)+'</strong>';
 const price=holding.mark?money(holding.mark.price,holding.currency)+' · '+displayDate(holding.mark.date):'No price entered';
 const summary='<div class="investment-details-grid">'+label('Units held',quantityLabel(stats.units))+label('Price or NAV per unit',price)+
  label('Recorded market value',stats.market===null?'—':report(stats.market))+label('Open cost basis',report(stats.cost))+
  label('Realized gain / loss',investmentDelta(stats.realized))+label('Net distributions',report(stats.income))+
  label('Unrealized gain / loss',stats.unrealized===null?'—':investmentDelta(stats.unrealized))+
  label('Combined gain / loss',stats.unrealized===null?'—':investmentDelta(stats.realized+stats.income+stats.unrealized))+'</div>';
 openModal(holding.name,summary+'<p class="form-note">Folio uses weighted-average cost and the rates entered for each trade and valuation. Investment activity stays separate from the cash ledger.</p>'+
  '<div class="cluster invest-details-actions">'+makeTrade(holding)+makePrice(holding)+button('investment-edit','Edit holding','edit','text-button',attr(holding))+'</div>'+
  '<h3 class="activity-heading">Activity history</h3>'+(rows||empty('No activity yet.')));
}
function removeInvestmentActivity(id,eventId) {
 const holding=holdingBy(id);
 if(!holding)return;
 confirmAction('Delete investment activity?','The portfolio will be recalculated from the remaining activity.','Delete activity',()=>{
  const latest=holdingBy(id);
  if(!latest)return feedback('This holding was removed.');
  const list=latest.activity.filter(row=>row.id!==eventId);
  if(!investmentStats({...latest,activity:list}))return feedback('This removal would leave a later sale with too few units. Edit or remove that sale first.');
  update(db=>{holdingBy(id,db).activity=list;},'Activity deleted.');
 });
}
const investmentValue=(value,zero=false)=>Number.isFinite(value)&&(zero?value>=0:value>0)&&value<=100000000000000;
function validInvestments(holdings,categoryIds=new Set(),groupById=new Map()) {
 if(holdings===undefined)return true;
 if(!Array.isArray(holdings)||holdings.length>1500)return false;
 const distinct=rows=>new Set(rows.map(item=>item.id)).size===rows.length;
 return holdings.every(item=>item&&validText(item.id)&&item.id.length>0&&validText(item.name)&&item.name.trim()&&
  validText(item.symbol)&&validText(item.account)&&investmentKindLabel.has(item.kind)&&currencies.includes(item.currency)&&
  (item.categoryId===undefined||categoryIds.has(item.categoryId))&&(item.groupId===undefined||groupById.get(item.groupId)===item.categoryId)&&
  (item.mark===null||(item.mark&&validDate(item.mark.date)&&investmentValue(item.mark.price,true)&&investmentValue(item.mark.rate)&&(item.currency!=='IDR'||item.mark.rate===1)))&&
  Array.isArray(item.activity)&&item.activity.length<=15000&&item.activity.every(row=>row&&validText(row.id)&&row.id.length>0&&
   ['buy','sell','income'].includes(row.type)&&validDate(row.date)&&validText(row.note)&&investmentValue(row.price,row.type!=='income')&&
   investmentValue(row.fee,true)&&investmentValue(row.rate)&&(item.currency!=='IDR'||row.rate===1)&&
   (row.type==='income'?row.quantity===0:investmentValue(row.quantity)&&row.quantity>=1/quantityScale))&&
  distinct(item.activity)&&investmentStats(item)!==null)&&distinct(holdings);
}
function handleInvestmentAction(action,id,target) {
 switch(action){
  case 'investment-add':investmentRegister();return true;
  case 'investment-edit':investmentRegister(id);return true;
  case 'investment-detail':investmentDetails(id);return true;
  case 'investment-event':investmentActivity(id,target.dataset.event);return true;
  case 'investment-price':investmentPrice(id);return true;
  case 'investment-rate':void useInvestmentRate(target);return true;
  case 'investment-remove-event':removeInvestmentActivity(id,target.dataset.event);return true;
  case 'investment-clear-price':
   update(db=>{holdingBy(id,db).mark=null;},'Valuation cleared.');
   return true;
  case 'investment-remove':
   confirmAction('Delete holding?','This removes the holding, its valuation, and its investment activity.','Delete holding',()=>{
    update(db=>{db.investments=db.investments.filter(holding=>holding.id!==id);},'Holding deleted.');
   });
   return true;
  default:return false;
 }
}
