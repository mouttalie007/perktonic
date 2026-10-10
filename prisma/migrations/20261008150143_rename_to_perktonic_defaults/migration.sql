-- AlterTable
ALTER TABLE "seo_settings" ALTER COLUMN "defaultTitle" SET DEFAULT 'PerkTonic — Free Samples, AI Tools, Rewards & Money-Saving Guides',
ALTER COLUMN "titleTemplate" SET DEFAULT '%s — PerkTonic',
ALTER COLUMN "defaultMetaDescription" SET DEFAULT 'Verified free samples, hidden AI tools, real rewards and smart money-saving guides — tested and explained simply.',
ALTER COLUMN "organizationName" SET DEFAULT 'PerkTonic';

-- AlterTable
ALTER TABLE "site_settings" ALTER COLUMN "siteName" SET DEFAULT 'PerkTonic.com',
ALTER COLUMN "siteUrl" SET DEFAULT 'https://perktonic.com',
ALTER COLUMN "tagline" SET DEFAULT 'Free Stuff. Smart Savings. Real Perks.';
