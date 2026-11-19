import { argon2idAsync } from '@noble/hashes/argon2.js';

const encode = new TextEncoder();
export const randomToken = (size=32) => toBase64(crypto.getRandomValues(new Uint8Array(size)));
export const toBase64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export const fromBase64 = text => Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')), character=>character.charCodeAt(0));
export const fingerprint = async text => toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256',encode.encode(text))));
const params = {m:19456,t:2,p:1,dkLen:32};
const derive = (password,salt) => argon2idAsync(encode.encode(password),fromBase64(salt),params);

export async function hashPassword(password) {
 const salt=randomToken(16);
 const hash=await derive(password,salt);
 return salt+'.'+toBase64(hash);
}

export async function checkPassword(password,stored) {
 const [salt,digest]=stored.split('.');
 const expected=fromBase64(digest);
 const actual=await derive(password,salt);
 let mismatch=actual.length^expected.length;
 for(let i=0;i<actual.length;i++)mismatch|=actual[i]^expected[i];
 return mismatch===0;
}
