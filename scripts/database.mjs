import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const migrationDir = new URL('../drizzle/', import.meta.url);

export function openDatabase(path = process.env.FOLIO_DB_PATH || './data/folio.sqlite') {
 const file = resolve(path);
 mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
 const db = new DatabaseSync(file);
 try {
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  db.exec('BEGIN IMMEDIATE');
  db.exec('CREATE TABLE IF NOT EXISTS vps_migrations (filename TEXT PRIMARY KEY, checksum TEXT NOT NULL)');
  const applied = db.prepare('SELECT checksum FROM vps_migrations WHERE filename = ?');
  const record = db.prepare('INSERT INTO vps_migrations (filename, checksum) VALUES (?, ?)');
  for (const name of readdirSync(migrationDir).filter(name => /^\d.*\.sql$/.test(name)).sort()) {
   const sql = readFileSync(new URL(name, migrationDir), 'utf8');
   const checksum = createHash('sha256').update(sql).digest('hex');
   const previous = applied.get(name);
   if (previous && previous.checksum !== checksum) throw Error('Applied migration was modified: ' + name);
   if (!previous) { db.exec(sql); record.run(name, checksum); }
  }
  db.exec('COMMIT');
  return db;
 } catch (error) {
  if (db.isTransaction) db.exec('ROLLBACK');
  db.close();
  throw error;
 }
}
