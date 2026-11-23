/*
 * Sign-in layer: checks the session, signs in with a password or passkey (WebAuthn), forces the temporary
 * password change, manages passkeys, then loads investments.js and app.js. Exposes window.Folio.api().
 * Bundled with @simplewebauthn/browser by scripts/build.mjs.
 */
import {startAuthentication,startRegistration,browserSupportsWebAuthn} from '@simplewebauthn/browser';
import * as balance from './balance.js';
import * as assets from './assets.js';

const byId=id=>document.getElementById(id);
const login=byId('login-form');
const firstPassword=byId('first-password-form');
const authLoading=byId('auth-loading');
const authLayout=byId('auth-layout');
const appShell=byId('app-shell');
const formValues=form=>Object.fromEntries(new FormData(form));
const shortenEmail=email=>email.split('@')[0];
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let user;

async function api(path,body,method=body===undefined?'GET':'POST'){
 const options={method,credentials:'same-origin',cache:'no-store'};
 if(body!==undefined){options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(body);}
 const response=await fetch('/api/'+path,options);
 const value=await response.json();
 if(!response.ok)throw Object.assign(new Error(value.error||'Something went wrong. Try again.'),{status:response.status});
 return value;
}
function show(name){
 authLoading.hidden=name!=='loading';
 byId('auth-login').hidden=name!=='login';
 byId('auth-change').hidden=name!=='change';
}
function formError(form,message){
 const element=form.querySelector('[role=alert]');
 element.textContent=message;
 element.hidden=!message;
}
async function runForm(form,button,operation){
 formError(form,'');
 const busyLabel=button.querySelector('[data-button-label]');
 const previousLabel=busyLabel?.textContent;
 for(const control of form.querySelectorAll('button'))control.disabled=true;
 button.setAttribute('aria-busy','true');
 if(busyLabel&&button.dataset.busyLabel)busyLabel.textContent=button.dataset.busyLabel;
 try{await operation();}
 catch(error){
  formError(form,error.name==='NotAllowedError'||error.name==='AbortError'?'Passkey sign-in was cancelled or no matching passkey was available.':error.message||'Unable to complete the request. Try again.');
 }finally{
  for(const control of form.querySelectorAll('button'))control.disabled=false;
  button.removeAttribute('aria-busy');
  if(busyLabel)busyLabel.textContent=previousLabel;
 }
}
function loadScript(src){
 return new Promise((resolve,reject)=>{
  const script=Object.assign(document.createElement('script'),{src,onload:resolve,onerror:()=>reject(Error('Folio could not load. Refresh and try again.'))});
  document.head.append(script);
 });
}
async function enter(session){
 user=session;
 if(!user){show('login');return;}
 if(user.mustChange){byId('change-email').value=user.email;show('change');return;}
 const saved=await api('workspace');
 window.Folio={...saved,user,api,openSecurity,balance,assets};
 await loadScript('/investments.js');
 await loadScript('/app.js');
 const name=shortenEmail(user.email);
 byId('account-name').textContent=name;
 byId('account-initial').textContent=name.charAt(0).toUpperCase();
 authLayout.hidden=true;
 appShell.hidden=false;
 document.getElementById('main').focus({preventScroll:true});
}
async function signOut(){
 await api('logout',{});
 location.replace('/');
}
login.addEventListener('submit',event=>{
 event.preventDefault();
 const values=formValues(login);
 void runForm(login,event.submitter,async()=>{
  const result=await api('login',values);
  login.reset();
  await enter(result.user);
 });
});
login.querySelector('.password-toggle').addEventListener('click',event=>{
 const input=login.elements.password, button=event.currentTarget;
 const reveal=input.type==='password';
 input.type=reveal?'text':'password';
 button.textContent=reveal?'Hide':'Show';
 button.setAttribute('aria-label',reveal?'Hide password':'Show password');
 button.setAttribute('aria-pressed',String(reveal));
});
byId('passkey-login').addEventListener('click',event=>{
 void runForm(login,event.currentTarget,async()=>{
  if(!browserSupportsWebAuthn())throw Error('Passkeys require a supported browser and secure connection.');
  const {id,options}=await api('passkeys/login/options',{});
  const response=await startAuthentication({optionsJSON:options});
  const result=await api('passkeys/login/verify',{id,response});
  login.reset();
  await enter(result.user);
 });
});
if(!browserSupportsWebAuthn())byId('passkey-login').hidden=true;
function matchingPasswords(values){
 if(values.newPassword!==values.confirmation)throw Error('The new passwords do not match.');
 return {currentPassword:values.currentPassword,newPassword:values.newPassword};
}
firstPassword.addEventListener('submit',event=>{
 event.preventDefault();
 void runForm(firstPassword,event.submitter,async()=>{
  const result=await api('password',matchingPasswords(formValues(firstPassword)));
  firstPassword.reset();
  await enter(result.user);
 });
});
byId('first-sign-out').addEventListener('click',event=>{void runForm(firstPassword,event.currentTarget,signOut);});

const modal=byId('dialog');
const errorLine='<p class="error" role="alert" hidden></p>';
const formActions=(label,back=true)=>'<div class="form-actions">'+(back?'<button type="button" class="btn" data-security-back>Back</button>':'')+'<button type="submit" class="btn primary">'+label+'</button></div>';
const keyDate=seconds=>new Date(seconds*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const passwordInput=(text,name,autocomplete,min=1)=>'<label>'+text+'<input name="'+name+'" type="password" autocomplete="'+autocomplete+'" required minlength="'+min+'" maxlength="128"></label>';
function securityPage(title,body){
 window.openModal(title,body);
}
async function openSecurity(message=''){
 securityPage('Security','<p class="security-description">'+escape(user.email)+'</p>'+
  (message?'<p class="form-note" role="status">'+escape(message)+'</p>':'')+
  '<section class="settings-block"><h3>Password</h3><p class="form-note">Changing your password signs out your other Folio sessions.</p>'+
  '<button type="button" class="btn" id="security-password">Change password</button></section>'+
  '<section class="settings-block"><h3>Passkeys</h3><p class="form-note">Use Face ID, a fingerprint, or a security key to sign in.</p>'+
  '<button type="button" class="btn" id="security-enroll">Add passkey</button><div id="security-keys" class="security-key-number" aria-live="polite"><small>Loading passkeys…</small></div></section>'+
  '<section class="settings-block"><button type="button" class="btn" id="security-logout">Sign out</button><p class="error" role="alert" hidden></p></section>');
 const list=byId('security-keys');
 byId('security-password').onclick=showPassword;
 byId('security-enroll').onclick=showEnrollment;
 byId('security-logout').onclick=async event=>{
  const button=event.currentTarget;
  button.disabled=true;
  try{await signOut();}
  catch(error){const alert=modal.querySelector('[role=alert]');alert.hidden=false;alert.textContent=error.message;}
  finally{button.disabled=false;}
 };
 try{
  const {passkeys}=await api('passkeys');
  if(!list.isConnected)return;
  list.innerHTML=passkeys.map(key=>'<div class="list-item"><div class="row-main"><strong>'+escape(key.name)+'</strong><small>Added '+escape(keyDate(key.created))+
   (key.used?' · Used '+escape(keyDate(key.used)):'')+'</small></div><button type="button" class="btn danger" data-remove-key="'+escape(key.id)+'">Remove</button></div>').join('')||'<small>No passkeys enrolled yet.</small>';
  for(const button of list.querySelectorAll('[data-remove-key]'))button.onclick=()=>showRemove(passkeys.find(key=>key.id===button.dataset.removeKey));
 }catch(error){if(list.isConnected)list.textContent=error.message;}
}
function securityForm(title,body,submitLabel,operation){
 securityPage(title,'<form id="security-form"><input name="email" type="email" autocomplete="username" value="'+escape(user.email)+'" hidden><div class="form-grid">'+body+'</div>'+errorLine+formActions(submitLabel)+'</form>');
 const form=byId('security-form');
 form.querySelector('[data-security-back]').onclick=()=>void openSecurity();
 form.onsubmit=event=>{
  event.preventDefault();
  const values=formValues(form);
  void runForm(form,event.submitter,()=>operation(values));
 };
}
function showPassword(){
 securityForm('Change password','<p class="form-note wide">Choose a new password with at least 8 characters.</p>'+
  '<div class="wide">'+passwordInput('Current password','currentPassword','current-password')+'</div>'+
  passwordInput('New password','newPassword','new-password',8)+passwordInput('Confirm new password','confirmation','new-password',8),
  'Save password',async values=>{
   const result=await api('password',matchingPasswords(values));
   user=result.user;
   window.Folio.user=user;
   await openSecurity('Password changed. Other sessions were signed out.');
  });
}
function showEnrollment(){
 securityForm('Add passkey','<p class="form-note wide">Name the passkey so you can recognize it later. Your device will ask you to confirm.</p>'+
  '<label>Passkey name<input name="name" maxlength="64" placeholder="e.g. iPhone"></label>'+passwordInput('Current password','password','current-password'),
  'Create passkey',async values=>{
   if(!browserSupportsWebAuthn())throw Error('This browser does not support passkeys.');
   const {id,options}=await api('passkeys/enroll/options',{password:values.password});
   const response=await startRegistration({optionsJSON:options});
   await api('passkeys/enroll/verify',{id,response,name:values.name});
   await openSecurity('Passkey added.');
  });
}
function showRemove(key){
 securityForm('Remove passkey','<p class="form-note wide">Remove '+escape(key.name)+' from this account?</p><div class="wide">'+passwordInput('Current password','password','current-password')+'</div>',
  'Remove passkey',async values=>{
   await api('passkeys/remove',{id:key.id,password:values.password});
   await openSecurity('Passkey removed.');
  });
}

(async()=>{
 try{const session=await api('session');await enter(session.user);}
 catch(error){
  show('login');
  formError(login,error.message||'Folio could not check your session.');
 }
})();
