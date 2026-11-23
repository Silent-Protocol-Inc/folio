/*
 * Folio request handler: export default { fetch(request, env) }, called by scripts/serve.mjs.
 * Serves the bundled static assets and the JSON API under /api (sign-in, sessions, password change,
 * passkeys, workspace load/save). Every response carries the security headers below.
 * See docs/ARCHITECTURE.md (request flow, security model) and docs/API.md (endpoints).
 */
import {admissibleWorkspace} from './workspace-schema.js';
import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse} from '@simplewebauthn/server';
import {checkPassword,fingerprint,fromBase64,hashPassword,randomToken,toBase64} from './password.js';
import page from '../public/index.html';
import dashboard from '../public/app.js';
import investments from '../public/investments.js';
import auth from 'folio-browser:auth';
import styles from '../public/style.css';
import favicon from '../public/mark.svg';
import artwork from '../public/folio-art.webp';
import geist from '../public/geist.woff2';
import touchIcon from '../public/apple-touch-icon.png';
import icon192 from '../public/icon-192.png';
import icon512 from '../public/icon-512.png';
import manifest from '../public/manifest.webmanifest';

const assets=new Map([
 ['/',[page,'text/html; charset=utf-8']],
 ['/app.js',[dashboard,'text/javascript; charset=utf-8']],
 ['/investments.js',[investments,'text/javascript; charset=utf-8']],
 ['/auth.js',[auth,'text/javascript; charset=utf-8']],
 ['/style.css',[styles,'text/css; charset=utf-8']],
 ['/mark.svg',[favicon,'image/svg+xml']],
 ['/folio-art.webp',[artwork,'image/webp']],
 ['/geist.woff2',[geist,'font/woff2']],
 ['/apple-touch-icon.png',[touchIcon,'image/png']],
 ['/apple-touch-icon-precomposed.png',[touchIcon,'image/png']],
 ['/favicon.ico',[icon192,'image/png']],
 ['/icon-192.png',[icon192,'image/png']],
 ['/icon-512.png',[icon512,'image/png']],
 ['/manifest.webmanifest',[manifest,'application/manifest+json']]
]);
const sessionAge=12*60*60;
const cookieName='__Host-folio_session';
const workspaceLimit=1024*1024;
const sessionCookie=(value,maxAge=sessionAge)=>cookieName+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge;
const now=()=>Math.floor(Date.now()/1000);
const securityHeaders={
 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; manifest-src 'self'; connect-src 'self' https://api.frankfurter.dev; base-uri 'none'; form-action 'self'; frame-ancestors 'self'; object-src 'none'",
 'Cache-Control':'no-store',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
 'Permissions-Policy':'publickey-credentials-create=(self), publickey-credentials-get=(self), geolocation=(), camera=(), microphone=()'
};
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{
 status,headers:{...securityHeaders,...headers,'Content-Type':'application/json; charset=utf-8'}
});
const fault=(message,status=400)=>json({error:message},status);
const isPassword=value=>typeof value==='string'&&value.length>0&&value.length<=128;
const verifyEmail=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const emailOf=value=>typeof value==='string'?value.trim().toLowerCase():'';
const validToken=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{20,200}$/.test(value);
const savedHash=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(value);
const idForEmail=email=>fingerprint('folio-account:'+email);
const readBootstrap=env=>{
 const parsed=JSON.parse(env.FOLIO_BOOTSTRAP_USERS??'{}');
 return Object.fromEntries(Object.entries(parsed).filter(([email,hash])=>verifyEmail(email)&&savedHash(hash)));
};
const roles=['owner','member'];
const accountView=user=>({email:user.email,role:user.role??'owner',mustChange:Boolean(user.must_change)});
const strongPassword=value=>isPassword(value)&&value.length>=8;
const sessionResponse=(user,token)=>json({user:accountView(user)},200,{'Set-Cookie':sessionCookie(token)});

class RequestError extends Error {
 constructor(message,status){super(message);this.status=status;}
}
async function input(request,max=64*1024) {
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new RequestError('Send a JSON request.',415);
 if(Number(request.headers.get('content-length'))>max||!request.body)throw new RequestError('This request is too large or incomplete.',413);
 const stream=request.body.getReader();
 const decoder=new TextDecoder();
 let text='', length=0;
 while(true){
  const {done,value}=await stream.read();
  if(done)break;
  length+=value.byteLength;
  if(length>max){await stream.cancel();throw new RequestError('This request is too large.',413);}
  text+=decoder.decode(value,{stream:true});
 }
 try{
  const parsed=JSON.parse(text+decoder.decode());
  if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;
 }catch{}
 throw new RequestError('The request is invalid.',400);
}
const prepare=(db,sql,...values)=>db.prepare(sql).bind(...values);
async function findSession(request,db) {
 const token=request.headers.get('cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!validToken(token))return null;
 const key=await fingerprint(token);
 return prepare(db,'SELECT a.id,a.email,a.role,a.must_change,a.auth_epoch,s.token_hash FROM folio_sessions s JOIN folio_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires>? AND s.auth_epoch=a.auth_epoch',key,now()).first();
}
const sessionStatement=(db,tokenHash,user)=>prepare(db,'INSERT INTO folio_sessions(token_hash,account_id,auth_epoch,expires) VALUES(?,?,?,?)',tokenHash,user.id,user.auth_epoch,now()+sessionAge);
async function createSession(db,user){
 const token=randomToken();
 await sessionStatement(db,await fingerprint(token),user).run();
 return sessionResponse(user,token);
}
async function rateAllowed(db,key,max) {
 const slot=Math.floor(now()/600);
 const row=await prepare(db,'INSERT INTO folio_auth_limits(rate_key,slot,attempts) VALUES(?,?,1) ON CONFLICT(rate_key) DO UPDATE SET attempts=CASE WHEN slot=excluded.slot THEN attempts+1 ELSE 1 END,slot=excluded.slot RETURNING attempts',await fingerprint(key),slot).first();
 return row.attempts<=max;
}
const requestIP=request=>request.headers.get('cf-connecting-ip')??'internal';
async function guardRate(request,db,purpose,identity,max) {
 const ip=requestIP(request);
 return await rateAllowed(db,purpose+'|ip|'+ip,max*4)&&await rateAllowed(db,purpose+'|account|'+ip+'|'+identity,max);
}
const tryLater=()=>fault('Too many attempts. Please wait a few minutes and try again.',429);
async function login(request,env) {
 const {DB:db}=env;
 const {email:submitted,password}=await input(request,8192);
 const email=emailOf(submitted);
 if(!verifyEmail(email)||!isPassword(password))return fault('Check your email and password.',401);
 if(!await guardRate(request,db,'password',email,6))return tryLater();
 let user=await prepare(db,'SELECT id,email,password_hash,role,must_change,auth_epoch FROM folio_accounts WHERE email=?',email).first();
 const bootstrapUsers=readBootstrap(env);
 const bootstrap=Object.hasOwn(bootstrapUsers,email)?bootstrapUsers[email]:null;
 const dummy=Object.values(bootstrapUsers)[0];
 if(!user&&!bootstrap&&!dummy)return fault('Check your email and password.',401);
 const hash=user?.password_hash??bootstrap??dummy;
 const verified=await checkPassword(password,hash);
 if(!verified||(!user&&!bootstrap))return fault('Check your email and password.',401);
 if(!user){
  const id=await idForEmail(email);
  const first=await prepare(db,'SELECT COUNT(*) AS count FROM folio_accounts').first();
  await prepare(db,'INSERT OR IGNORE INTO folio_accounts(id,email,password_hash,role) VALUES(?,?,?,?)',id,email,bootstrap,first.count===0?'owner':'member').run();
  user=await prepare(db,'SELECT id,email,password_hash,role,must_change,auth_epoch FROM folio_accounts WHERE id=?',id).first();
  if(user.password_hash!==bootstrap)return fault('Check your email and password.',401);
 }
 return createSession(db,user);
}
async function changePassword(request,db,session){
 if(!await guardRate(request,db,'change',session.id,6))return tryLater();
 const {currentPassword,newPassword}=await input(request,8192);
 if(!isPassword(currentPassword)||!strongPassword(newPassword))return fault('Use at least 8 characters for your new password.');
 if(newPassword===currentPassword)return fault('Choose a different password.');
 const account=await prepare(db,'SELECT password_hash FROM folio_accounts WHERE id=? AND auth_epoch=?',session.id,session.auth_epoch).first();
 if(!account||!await checkPassword(currentPassword,account.password_hash))return fault('The current password is incorrect.',401);
 const hash=await hashPassword(newPassword);
 const next={...session,must_change:0,auth_epoch:session.auth_epoch+1};
 const token=randomToken();
 const changed=await prepare(db,'UPDATE folio_accounts SET password_hash=?,must_change=0,auth_epoch=auth_epoch+1 WHERE id=? AND auth_epoch=? RETURNING id',hash,session.id,session.auth_epoch).first();
 if(!changed)return fault('Your security settings changed. Sign in again.',409);
 await db.batch([
  prepare(db,'DELETE FROM folio_sessions WHERE account_id=? AND auth_epoch<?',session.id,next.auth_epoch),
  sessionStatement(db,await fingerprint(token),next)
 ]);
 return sessionResponse(next,token);
}
async function challenge(db,accountId,purpose,options,sessionHash=null){
 const id=randomToken(24);
 await db.batch([
  prepare(db,'DELETE FROM folio_challenges WHERE expires<?',now()),
  prepare(db,'INSERT INTO folio_challenges(id,challenge,account_id,session_hash,purpose,expires) VALUES(?,?,?,?,?,?)',id,options.challenge,accountId,sessionHash,purpose,now()+300)
 ]);
 return json({id,options});
}
function assertion(db,id,purpose,sessionHash=null){
 if(!validToken(id))return null;
 return prepare(db,'DELETE FROM folio_challenges WHERE id=? AND purpose=? AND expires>? AND session_hash IS ? RETURNING account_id,challenge',id,purpose,now(),sessionHash).first();
}
const accountKeys=(db,accountId)=>prepare(db,'SELECT credential_id,transports FROM folio_passkeys WHERE account_id=? ORDER BY created_at',accountId).all();
const credentialList=rows=>rows.map(row=>({id:row.credential_id,transports:JSON.parse(row.transports)}));
async function passkeyLoginOptions(request,db,rpID){
 await input(request,8192);
 if(!await guardRate(request,db,'passkey','discoverable',12))return tryLater();
 const options=await generateAuthenticationOptions({
  rpID,userVerification:'required',timeout:120000
 });
 return challenge(db,'','login',options);
}
async function passkeyLogin(request,db,rpID,origin){
 const data=await input(request);
 const attempt=await assertion(db,data.id,'login');
 if(!attempt)return fault('The passkey request expired. Try again.',401);
 const row=await prepare(db,'SELECT k.*,a.email,a.role,a.must_change,a.auth_epoch,a.id FROM folio_passkeys k JOIN folio_accounts a ON a.id=k.account_id WHERE k.credential_id=?',String(data.response?.id??'')).first();
 if(!row||row.must_change)return fault('This passkey could not sign you in.',401);
 try {
  const verified=await verifyAuthenticationResponse({
   response:data.response,expectedChallenge:attempt.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,
   credential:{id:row.credential_id,publicKey:fromBase64(row.public_key),counter:row.counter,transports:JSON.parse(row.transports)}
  });
  if(!verified.verified)return fault('This passkey could not sign you in.',401);
  const result=await prepare(db,'UPDATE folio_passkeys SET counter=?,used_at=? WHERE credential_id=? AND counter=? RETURNING credential_id',verified.authenticationInfo.newCounter,now(),row.credential_id,row.counter).first();
  if(!result)return fault('The passkey changed. Try again.',409);
  return createSession(db,row);
 }catch{return fault('This passkey could not sign you in.',401);}
}
async function passkeyEnrollOptions(request,db,session,rpID){
 if(!await guardRate(request,db,'enroll',session.id,6))return tryLater();
 await input(request,8192);
 const {results}=await accountKeys(db,session.id);
 if(results.length>=10)return fault('Remove a passkey before adding another.');
 const options=await generateRegistrationOptions({
  rpName:'Folio',rpID,userName:session.email,userDisplayName:session.email,userID:fromBase64(session.id),
  attestationType:'none',excludeCredentials:credentialList(results),timeout:120000,
  authenticatorSelection:{residentKey:'required',userVerification:'required'}
 });
 return challenge(db,session.id,'enroll',options,session.token_hash);
}
async function passkeyEnroll(request,db,session,rpID,origin){
 const data=await input(request);
 const name=typeof data.name==='string'?data.name.trim().slice(0,64):'';
 const attempt=await assertion(db,data.id,'enroll',session.token_hash);
 if(!attempt||attempt.account_id!==session.id)return fault('The passkey request expired. Try again.',401);
 try {
  const verified=await verifyRegistrationResponse({
   response:data.response,expectedChallenge:attempt.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true
  });
  if(!verified.verified)return fault('The passkey could not be verified.');
  const key=verified.registrationInfo.credential;
  const inserted=await prepare(db,'INSERT OR IGNORE INTO folio_passkeys(credential_id,account_id,public_key,counter,transports,name,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM folio_passkeys WHERE account_id=?)<10 AND EXISTS (SELECT 1 FROM folio_accounts WHERE id=? AND auth_epoch=?) RETURNING credential_id',key.id,session.id,toBase64(key.publicKey),key.counter,JSON.stringify(key.transports??[]),name||'Passkey',now(),session.id,session.id,session.auth_epoch).first();
  return inserted?json({ok:true}):fault('That passkey is already saved or the limit was reached.',409);
 }catch{return fault('The passkey could not be verified.');}
}

async function workspace(request,db,session){
 if(request.method==='GET'){
  const row=await prepare(db,'SELECT workspace,revision FROM folio_accounts WHERE id=? AND auth_epoch=?',session.id,session.auth_epoch).first();
  return row?json({workspace:row.workspace?JSON.parse(row.workspace):null,revision:row.revision}):fault('Sign in again.',401);
 }
 const data=await input(request,workspaceLimit);
 if(!Number.isSafeInteger(data.revision)||data.revision<0||!admissibleWorkspace(data.workspace))return fault('This workspace could not be saved.');
 const stored=JSON.stringify(data.workspace);
 const row=await prepare(db,'UPDATE folio_accounts SET workspace=?,revision=revision+1 WHERE id=? AND revision=? AND auth_epoch=? RETURNING revision',stored,session.id,data.revision,session.auth_epoch).first();
 return row?json(row):fault('Your workspace changed in another window. Reload Folio before saving again.',409);
}
function financialSnapshot(workspace){
 const rows=Array.isArray(workspace?.transactions)?workspace.transactions:[];
 const operational=rows.filter(row=>!row.balanceAdjustment);
 const income=operational.filter(row=>row.type==='income').reduce((total,row)=>total+row.amount*row.rate,0);
 const expense=operational.filter(row=>row.type==='expense').reduce((total,row)=>total+row.amount*row.rate,0);
 return {currency:workspace?.currency,transactionCount:rows.length,income,expense,
  expenseByCategory:Object.fromEntries([...new Set(operational.filter(row=>row.type==='expense').map(row=>row.category))].map(category=>[category,operational.filter(row=>row.type==='expense'&&row.category===category).reduce((total,row)=>total+row.amount*row.rate,0)])),
  budgets:(workspace?.budgets??[]).map(row=>({category:row.category,amount:row.amount*row.rate})),
  debts:(workspace?.debts??[]).map(row=>({direction:row.direction,amount:row.amount*row.rate,due:row.due||null})),
  subscriptions:(workspace?.subscriptions??[]).filter(row=>row.status==='active').map(row=>({amount:row.amount*row.rate,cycle:row.cycle,due:row.due})),
  goals:(workspace?.goals??[]).map(row=>({title:row.title,target:row.amount*row.rate,saved:(row.contributions??[]).reduce((total,item)=>total+item.amount*row.rate,0),due:row.due||null})),
  investments:(workspace?.investments??[]).map(row=>({kind:row.kind,account:row.account,activityCount:(row.activity??[]).length,valuation:row.mark?row.mark.price*row.mark.rate:null}))};
}
const adviceRules='Return JSON only: {"summary":string,"actions":[{"type":"budget","category":string,"amount":number,"reason":string}],"watchlist":[string]}. Give educational planning guidance, not a trade instruction. Budget actions must use only supplied expense categories and positive amounts.';
async function providerAdvice(provider,snapshot,env){
 const prompt=adviceRules+' Financial snapshot (aggregate only): '+JSON.stringify(snapshot);
 if(provider==='codex'){
  if(!env.FOLIO_OPENAI_API_KEY)return null;
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.FOLIO_OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.FOLIO_CODEX_MODEL||'gpt-6-luna',store:false,input:prompt})});
  if(!response.ok)throw Error('Codex advice is temporarily unavailable.');
  const body=await response.json();
  return body.output_text??body.output?.flatMap(item=>item.content??[]).map(item=>item.text??'').join('');
 }
 if(!env.FOLIO_ANTHROPIC_API_KEY)return null;
 const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':env.FOLIO_ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify({model:env.FOLIO_CLAUDE_MODEL||'claude-haiku-4-5',max_tokens:700,messages:[{role:'user',content:prompt}]})});
 if(!response.ok)throw Error('Claude advice is temporarily unavailable.');
 const body=await response.json();
 return body.content?.map(item=>item.text??'').join('');
}
function validAdvice(value,snapshot){
 if(!value||typeof value.summary!=='string'||!Array.isArray(value.actions)||!Array.isArray(value.watchlist))return null;
 const categories=new Set(Object.keys(snapshot.expenseByCategory));
 const actions=value.actions.filter(action=>action&&action.type==='budget'&&categories.has(action.category)&&Number.isFinite(action.amount)&&action.amount>0&&typeof action.reason==='string').slice(0,6).map(action=>({type:'budget',category:action.category,amount:Math.round(action.amount*100)/100,reason:action.reason.slice(0,500)}));
 return {summary:value.summary.slice(0,1500),actions,watchlist:value.watchlist.filter(item=>typeof item==='string').slice(0,8).map(item=>item.slice(0,500))};
}
async function advice(request,db,session,env){
 const {provider}=await input(request,8192);
 if(!['codex','claude'].includes(provider))return fault('Choose Codex or Claude.');
 if(!await guardRate(request,db,'advice',session.id,4))return tryLater();
 const row=await prepare(db,'SELECT workspace FROM folio_accounts WHERE id=? AND auth_epoch=?',session.id,session.auth_epoch).first();
 const snapshot=financialSnapshot(row?.workspace?JSON.parse(row.workspace):{});
 const result=await providerAdvice(provider,snapshot,env);
 if(!result)return fault(provider==='codex'?'Codex advice is not configured.':'Claude advice is not configured.',503);
 try{const parsed=JSON.parse(result.replace(/^```json\s*|\s*```$/g,''));const parsedAdvice=validAdvice(parsed,snapshot);return parsedAdvice?json({provider,advice:parsedAdvice}):fault('The provider returned an invalid proposal.',502);}catch{return fault('The provider returned an invalid proposal.',502);}
}
const requireOwner=session=>session.role==='owner';
async function accounts(request,db,session){
 if(!requireOwner(session))return fault('Only an owner can manage workspace accounts.',403);
 if(request.method==='GET'){
  const {results}=await prepare(db,'SELECT id,email,role,must_change,revision FROM folio_accounts ORDER BY email').all();
  return json({accounts:results.map(account=>({id:account.id,email:account.email,role:account.role,mustChange:Boolean(account.must_change),revision:account.revision}))});
 }
 const {email:submitted,role,password}=await input(request,8192),email=emailOf(submitted);
 if(!verifyEmail(email)||!roles.includes(role)||!isPassword(password))return fault('Enter a valid email, role, and your current password.');
 if(!await guardRate(request,db,'account-create',session.id,4))return tryLater();
 const owner=await prepare(db,'SELECT password_hash FROM folio_accounts WHERE id=? AND auth_epoch=?',session.id,session.auth_epoch).first();
 if(!owner||!await checkPassword(password,owner.password_hash))return fault('The current password is incorrect.',401);
 if(await prepare(db,'SELECT 1 FROM folio_accounts WHERE email=?',email).first())return fault('That email already has an account.',409);
 const temporary=randomToken(18),hash=await hashPassword(temporary),id=await idForEmail(email);
 await prepare(db,'INSERT INTO folio_accounts(id,email,password_hash,role) VALUES(?,?,?,?)',id,email,hash,role).run();
 return json({account:{id,email,role,mustChange:true},temporaryPassword:temporary},201);
}
async function accountRole(request,db,session,id){
 if(!requireOwner(session))return fault('Only an owner can manage workspace accounts.',403);
 const {role,password}=await input(request,8192);
 if(!roles.includes(role)||!isPassword(password))return fault('Choose a valid role and enter your current password.');
 const owner=await prepare(db,'SELECT password_hash FROM folio_accounts WHERE id=? AND auth_epoch=?',session.id,session.auth_epoch).first();
 if(!owner||!await checkPassword(password,owner.password_hash))return fault('The current password is incorrect.',401);
 if(id===session.id&&role!=='owner')return fault('You cannot remove your own owner role.');
 const target=await prepare(db,'SELECT role FROM folio_accounts WHERE id=?',id).first();
 if(!target)return fault('Account not found.',404);
 if(target.role==='owner'&&role==='member'){
  const count=await prepare(db,"SELECT COUNT(*) AS count FROM folio_accounts WHERE role='owner'").first();
  if(count.count<2)return fault('Keep at least one owner account.',409);
 }
 const changed=await prepare(db,'UPDATE folio_accounts SET role=? WHERE id=? RETURNING id,email,role',role,id).first();
 return changed?json({account:changed}):fault('Account not found.',404);
}
async function api(request,env,path){
 const {DB:db}=env;
 if(!db)return fault('Folio storage is temporarily unavailable.',503);
 const origin=env.FOLIO_ORIGIN;
 const rpID=new URL(origin).hostname;
 const method=request.method;
 if(method!=='GET'&&request.headers.get('origin')!==origin)return fault('Request origin rejected.',403);
 if(method==='POST'&&path==='/api/login')return login(request,env);
 if(method==='POST'&&path==='/api/passkeys/login/options')return passkeyLoginOptions(request,db,rpID);
 if(method==='POST'&&path==='/api/passkeys/login/verify')return passkeyLogin(request,db,rpID,origin);
 const session=await findSession(request,db);
 if(method==='GET'&&path==='/api/session')return json({user:session?accountView(session):null});
 if(!session)return fault('Sign in again to continue.',401);
 if(method==='POST'&&path==='/api/logout'){
  await prepare(db,'DELETE FROM folio_sessions WHERE token_hash=?',session.token_hash).run();
  return json({ok:true},200,{'Set-Cookie':sessionCookie('',0)});
 }
 if(method==='POST'&&path==='/api/password')return changePassword(request,db,session);
 if(session.must_change)return fault('Change your temporary password first.',403);
 if((method==='GET'||method==='PUT')&&path==='/api/workspace')return workspace(request,db,session);
 if(method==='POST'&&path==='/api/advice')return advice(request,db,session,env);
 if((method==='GET'||method==='POST')&&path==='/api/accounts')return accounts(request,db,session);
 if(method==='PUT'&&path.startsWith('/api/accounts/'))return accountRole(request,db,session,path.slice('/api/accounts/'.length));
 if(method==='GET'&&path==='/api/passkeys'){
  const {results}=await prepare(db,'SELECT credential_id AS id,name,created_at AS created,used_at AS used FROM folio_passkeys WHERE account_id=? ORDER BY created_at DESC',session.id).all();
  return json({passkeys:results});
 }
 if(method==='POST'&&path==='/api/passkeys/enroll/options')return passkeyEnrollOptions(request,db,session,rpID);
 if(method==='POST'&&path==='/api/passkeys/enroll/verify')return passkeyEnroll(request,db,session,rpID,origin);
 if(method==='POST'&&path==='/api/passkeys/remove'){
  const {id,password}=await input(request,8192);
  if(!isPassword(password)||typeof id!=='string')return fault('Enter your current password.');
  if(!await guardRate(request,db,'remove',session.id,6))return tryLater();
  const account=await prepare(db,'SELECT password_hash FROM folio_accounts WHERE id=? AND auth_epoch=?',session.id,session.auth_epoch).first();
  if(!account||!await checkPassword(password,account.password_hash))return fault('The current password is incorrect.',401);
  await prepare(db,'DELETE FROM folio_passkeys WHERE credential_id=? AND account_id=? AND EXISTS (SELECT 1 FROM folio_accounts WHERE id=? AND auth_epoch=?)',id,session.id,session.id,session.auth_epoch).run();
  return json({ok:true});
 }
 return fault('Page not found.',404);
}

export default {
 async fetch(request,env){
  try{
   const path=new URL(request.url).pathname;
   if(path.startsWith('/api/'))return await api(request,env,path);
   const asset=assets.get(path);
   if(!asset||!['GET','HEAD'].includes(request.method))return fault('Page not found.',404);
   // Icons and the manifest are cacheable: iOS falls back to a letter tile when the touch icon is no-store.
   const cache=/^(image\/png|application\/manifest\+json)$/.test(asset[1])?{'Cache-Control':'public, max-age=86400'}:{};
   return new Response(request.method==='HEAD'?null:asset[0],{headers:{...securityHeaders,'Content-Type':asset[1],...cache}});
  }catch(error){
   if(error instanceof RequestError)return fault(error.message,error.status);
   console.error('Folio request error',error?.name??'Error');
   return fault('Folio is temporarily unavailable. Please try again.',503);
  }
 }
};
