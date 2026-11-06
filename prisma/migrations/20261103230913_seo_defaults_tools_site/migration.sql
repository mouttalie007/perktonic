-- AlterTable
ALTER TABLE "seo_settings" ALTER COLUMN "defaultTitle" SET DEFAULT 'PerkTonic: Free Online Tools for Spreadsheets & Data',
ALTER COLUMN "titleTemplate" SET DEFAULT '%s | PerkTonic',
ALTER COLUMN "defaultMetaDescription" SET DEFAULT 'Free online tools for Excel and Google Sheets formulas, CSV and JSON files, PDF tables, documents and website checks. No account needed.';
-- New default SEO copy (tools site). Columns get the new defaults, and a row is rewritten only while it still
-- holds the OLD default text, so anything an admin has typed is kept.
UPDATE "seo_settings" SET "defaultTitle" = 'PerkTonic: Free Online Tools for Spreadsheets & Data' WHERE "defaultTitle" = 'PerkTonic: Free Stuff, Hidden Web Tricks & Smart Deals';
UPDATE "seo_settings" SET "titleTemplate" = '%s | PerkTonic' WHERE "titleTemplate" = '%s — PerkTonic';
UPDATE "seo_settings" SET "defaultMetaDescription" = 'Free online tools for Excel and Google Sheets formulas, CSV and JSON files, PDF tables, documents and website checks. No account needed.' WHERE "defaultMetaDescription" = 'Discover free samples, hidden Google features, free AI tools, rewards and money-saving tricks. Honest, tested guides updated regularly.';
