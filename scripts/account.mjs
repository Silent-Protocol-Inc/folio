import { fingerprint, hashPassword, randomToken } from '../server/password.js';
import { openDatabase } from './database.mjs';

process.umask(0o077);
const email = process.argv[2]?.trim().toLowerCase();
if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || process.argv.length !== 3) {
 console.error('Usage: npm run account:add -- owner@example.com');
 process.exit(1);
}
const db = openDatabase();
try {
 if (db.prepare('SELECT 1 FROM folio_accounts WHERE email = ?').get(email)) throw Error('That account already exists.');
 const temporary = randomToken(18);
 const hash = await hashPassword(temporary);
 const id = await fingerprint('folio-account:' + email);
 const inserted = db.prepare('INSERT INTO folio_accounts (id,email,password_hash) VALUES (?,?,?) ON CONFLICT(email) DO NOTHING').run(id, email, hash);
 if (!inserted.changes) throw Error('That account already exists.');
 console.log('Account: ' + email);
 console.log('Temporary password (shown once): ' + temporary);
 console.log('The account must set a new password on first sign-in.');
} catch (error) {
 console.error(error.message);
 process.exitCode = 1;
} finally {
 db.close();
}
