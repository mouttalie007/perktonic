# Deploying PerkTonic to Namecheap Stellar Plus (cPanel)

This replaces the VPS runbook (`deploy/README.md`) as the deployment target
for **this** project. The VPS files in this directory are kept only because
a separate, unrelated deployment is still live there — nothing here touches
that box. PerkTonic goes to shared hosting via cPanel's "Setup Node.js App"
(Phusion Passenger), not systemd/nginx.

## Why Stellar Plus, specifically

The base **Stellar** plan only has MySQL — no PostgreSQL at all. This app
is Prisma + PostgreSQL throughout (no raw SQL, no `@db.*` native-type
annotations, no extensions in `schema.prisma`), so porting to MySQL would
mean a new schema, new migrations and re-testing everything. **Stellar
Plus** (and Business) include PostgreSQL, so the app's data layer needs
zero changes — only the deployment mechanics change.

**Known risk, not a blocker:** Stellar Plus's PostgreSQL is version
**10.23**. PG10 reached end-of-life in November 2022 (no security
patches), and local dev runs PG18. Checked this schema against it: no
native-type annotations, no extensions, no raw `$queryRaw`/`$executeRaw`
anywhere in `src/` — everything goes through Prisma's query builder, which
targets PG 9.6+. Expect it to work, but the migration deploy step below is
the real test; if something in a newer migration doesn't apply cleanly,
that's the first place to look. Longer-term, an EOL Postgres version is
worth revisiting if Namecheap ever offers newer PG on this tier.

## What actually changes vs. the VPS plan

| | VPS (old) | Namecheap Stellar Plus |
|---|---|---|
| Process manager | systemd unit | cPanel "Setup Node.js App" (Passenger) |
| Reverse proxy | nginx, manual vhost | Apache + Passenger, managed by cPanel |
| Entry point | `npm run start` (`next start`) | `node server.js` (see below — required) |
| Root/SSH | full root SSH | jailed SSH (no root, but npm/node/git work) |
| TLS | manual certbot + Cloudflare | AutoSSL, one click in cPanel |
| Deploy transfer | tarball over `pscp` | `git clone`/`pull` over the jailed SSH, or cPanel Git Version Control |

## Why `server.js` exists now

cPanel's Node.js Selector needs a literal `"NAME.js"` startup file it runs
with `node` — it can't be pointed at the `next start` CLI the way the
systemd unit was. `server.js` (repo root) is the official Next.js
custom-server pattern: it reads `PORT` from the environment (Passenger
assigns this and proxies the domain to it) and does nothing else —
middleware, API routes, ISR and Image Optimization all behave exactly as
under plain `next start`. A new script covers it:

```
npm run start:cpanel   # -> node server.js
```

The VPS's `npm run start` (`next start`) is untouched and still works
there — this is additive, not a replacement.

## Setup steps (first deploy)

### 0. Prerequisites

- Namecheap Stellar Plus account, domain's DNS already pointed at it
  (A record, or it's the account's primary domain).
- This repo has a remote you can `git clone` from the jailed SSH shell
  (GitHub, GitLab, etc.) — the VPS deploy used a tarball because no remote
  existed yet; set one up for this, it makes every redeploy a `git pull`.

### 1. Database (cPanel UI)

cPanel → **PostgreSQL Database Wizard**:

1. Create a database (e.g. `<cpanelusername>_perktonic`).
2. Create a role/user with a strong password, grant it ALL PRIVILEGES on
   that database.
3. Note the exact DB name/user — cPanel prefixes both with your cPanel
   username (e.g. `cpuser_perktonic`), unlike the VPS where the role was
   just `viraltrendly`.

### 2. Code onto the server

Via SSH (cPanel → **SSH Access**, or **Terminal** in the UI):

```sh
cd ~                     # jailed home, not /srv — no root here
git clone <your-remote-url> perktonic
cd perktonic
npm ci
```

If `npm ci` is slow/killed on shared CPU limits, `npm install` with
`--no-audit --no-fund` is a lighter fallback.

### 3. Environment variables

Two options — pick one, don't split config across both:

- **cPanel's Node.js App "Environment Variables" panel** (Add Variable per
  key) — set after creating the app in step 5. Doesn't touch disk.
- **A `.env` file** in the app root, same as the VPS (`chmod 600 .env`) —
  simpler if you're already managing `.env.production.example` this way.

Required, same variable names as the VPS deploy:

- `DATABASE_URL` — `postgresql://<user>:<password>@localhost:5432/<db>?schema=public`
  (cPanel Postgres is local to the account, not a remote host)
- `NEXT_PUBLIC_SITE_URL` — `https://<your-domain>`
- `PORT` — cPanel's Node.js Selector sets this itself when the app starts;
  don't hardcode it in `.env`
- `MEDIA_PROVIDER="local"` (same as VPS — uploads land in `public/uploads`,
  see the note below)
- AdSense/analytics/newsletter vars — same as VPS, blank until those
  accounts exist

### 4. Migrate, seed, build — **in this order**, same reasoning as the VPS doc

```sh
npx prisma migrate deploy       # NOT migrate dev — applies existing migrations only
npm run db:seed:prod            # structural data only, never plain db:seed here
npm run build
```

Watch `migrate deploy`'s output carefully here specifically because of the
PG10.23 question above — if a migration fails, that's the compatibility
signal to act on, not a generic retry.

### 5. Create the Node.js App (cPanel UI)

cPanel → **Setup Node.js App** → Create Application:

- **Node.js version**: pick the highest available (need ≥20.19 — this
  project's `package.json` `engines.node` requirement; confirm the actual
  version list on your account, cPanel's Node Selector has offered 20.x/
  22.x widely but it's per-server, verify before relying on it).
- **Application mode**: Production.
- **Application root**: `perktonic` (the directory from step 2).
- **Application URL**: your domain (or subdomain, if you want PerkTonic on
  a subdomain of something else).
- **Application startup file**: `server.js`.
- Save, then use the **Run NPM Install** button if you skipped step 2's
  manual `npm ci` (not both — redundant).
- **Start App**.

### 6. SSL

cPanel → **SSL/TLS Status** → run **AutoSSL** for the domain. One click,
no certbot/Cloudflare dance — this is the one part genuinely simpler than
the VPS.

### 7. Smoke test

Same checklist as the VPS doc's "Post-deploy smoke test":

- Homepage loads, no console errors
- `/admin/login` reachable, log in works
- Submit the contact form, confirm it lands in `/admin/contact-messages`
- `curl -sI https://<domain>/ | grep -i content-security-policy` — header
  present
- Upload a featured image from the admin, confirm it actually renders (this
  is the one thing worth checking carefully — see below)

## `public/uploads` — the one thing most likely to surprise you

`MEDIA_PROVIDER=local` writes every uploaded image to
`<app root>/public/uploads/<file>.webp` and stores `/uploads/<file>.webp`
as the URL in the `Media` row (see `src/app/actions/admin-media.ts`). Under
Passenger, the whole domain's traffic — including `/uploads/*` — is routed
through the Node process, which serves it out of Next's own static
handling, same as any other file under `public/`. This should Just Work
with no extra Apache/`.htaccess` config, but it's new territory (the VPS
ran this same code behind nginx, not Passenger) — verify an actual uploaded
image renders in step 7, don't assume it from the VPS having worked.

## Redeploying later

```sh
cd ~/perktonic
git pull
npm ci
npx prisma migrate deploy   # no-op if there are no new migrations
npm run build
```

Then cPanel → **Setup Node.js App** → **Restart** (no `chown`/`systemctl`
step here — Passenger owns the process lifecycle, there's no separate
build-user-vs-service-user split like the VPS had).

## What's intentionally NOT ported from the VPS doc

- The `chown -R` dance — that bug was specific to the VPS's separate
  `viraltrendly` system user vs. whoever ran the build over SSH; cPanel
  shared hosting has one user for everything, this class of bug can't
  happen the same way.
- `deploy/viraltrendly.service` / `deploy/nginx-viraltrendly.conf` —
  VPS-only, not applicable here at all.
