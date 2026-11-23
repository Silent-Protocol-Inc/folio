ALTER TABLE folio_accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
UPDATE folio_accounts
SET role = 'owner'
WHERE id = (SELECT id FROM folio_accounts ORDER BY rowid LIMIT 1);
