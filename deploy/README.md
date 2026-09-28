# Deploying ViralTrendly to the VPS

Target: `109.205.179.106`, shared with the unrelated `live.dimabac.com`
project. Full coexistence rules live in the `viraltrendly-vps` memory —
the short version: new files only, new port (3100), new systemd unit with
resource caps, own native Postgres, own nginx vhost. Never touch
`dimabac-live.service`, `livekit.service`,
`/etc/nginx/sites-available/live.dimabac.com`, or `default`.

**Status (2026-09-13): live at http://109.205.179.106/**, IP-only — no
domain/Cloudflare/TLS yet (deliberately deferred, see "Adding a domain
later" below). Steps 0-6 below are done on the box; this file stays as the
runbook for redeploys and for whoever adds the domain later.

## 0. Prerequisites (once) — done

- On the VPS: Node.js v22 LTS, npm, PostgreSQL 14 (installed via apt — not
  present before), nginx (already there), certbot (already there, unused
  until a domain exists).
- App system user: `viraltrendly` (`useradd --system --no-create-home
  --shell /usr/sbin/nologin viraltrendly`).

## 1. Database — done

```sh
sudo -u postgres psql -c "CREATE ROLE viraltrendly WITH LOGIN PASSWORD '...';"
sudo -u postgres psql -c "CREATE DATABASE viraltrendly OWNER viraltrendly;"
```

Real password is in `/srv/viraltrendly/.env` on the box only — not
recorded anywhere else. Confirmed with a direct `psql -h 127.0.0.1`
connection, not just assumed from the CREATE ROLE output — the first
attempt's password silently didn't take (multiple layers of shell quoting
across the SSH hop swallowed something), which only surfaced as a Prisma
auth error during the first build attempt. `ALTER ROLE ... WITH PASSWORD`
+ a direct `psql` connection test fixed and confirmed it.

## 2. Code onto the box — done (tarball, not git)

No git remote exists for this repo yet, so the first deploy went via a
tarball rather than `git clone`:

```sh
# locally — exclude dev-only stuff. IMPORTANT: also exclude anything
# .gitignore excludes that isn't in this explicit list (the first attempt
# missed this and shipped the raw multi-MB author source photos + a
# .claude/ session-lock dir to the server — harmless, but sloppy; cleaned
# up by hand after. `git archive` on a real remote avoids this entirely).
tar --exclude=node_modules --exclude=.next --exclude=.git \
    --exclude=scripts/.audit --exclude=public/uploads \
    --exclude=.env --exclude=.env.local --exclude='VPS login' \
    -czf /tmp/viraltrendly-deploy.tar.gz .
pscp -batch -hostkey <fingerprint> -pw <pass> /tmp/viraltrendly-deploy.tar.gz root@109.205.179.106:/tmp/
# on the VPS:
mkdir -p /srv/viraltrendly
tar -xzf /tmp/viraltrendly-deploy.tar.gz -C /srv/viraltrendly
rm /tmp/viraltrendly-deploy.tar.gz
cd /srv/viraltrendly && npm ci
```

Once a real git remote exists, switch this step to `git clone`/`git pull`
(see "Redeploying later").

## 3. Environment — done

`.env` on the box (not `.env.production.example` — copied then edited):

- `NEXT_PUBLIC_SITE_URL="http://109.205.179.106"` (IP-only for now — **must
  change + rebuild** once a domain exists, see below)
- `PORT="3100"`
- real `DATABASE_URL` with the role's password
- `MEDIA_PROVIDER="local"`
- AdSense/analytics/newsletter vars left blank (none of those accounts
  exist yet)

`chmod 600 .env`, owned by `viraltrendly:viraltrendly`.

## 4. Migrate, seed, build — done, **in this order**

The original draft of this runbook had build before migrate — wrong for a
first deploy: `next build` statically generates pages that query the DB
(e.g. `/[pageSlug]`, `/category/[slug]`), so the schema must exist first.
Redeploys where the schema is already current are more forgiving of the
order, but do it this way every time regardless:

```sh
npx prisma migrate deploy       # NOT `migrate dev` — only applies existing
                                 # migrations, never prompts, never resets
npm run db:seed:prod            # structural data only. NEVER plain
                                 # `db:seed` here — it publishes 11 fake
                                 # demo articles + fake comments +
                                 # randomized reactions onto the real site
npm run build
```

`db:seed:prod` printed the generated admin password to the terminal
**exactly once** — already captured and relayed to the user directly
(not written to any file on either machine). Change it via `/admin` → My
Account as soon as convenient.

## 5. systemd — done

```sh
chown -R viraltrendly:viraltrendly /srv/viraltrendly
cp deploy/viraltrendly.service /etc/systemd/system/viraltrendly.service
systemctl daemon-reload
systemctl enable --now viraltrendly.service
systemctl status viraltrendly.service        # active (running)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3100/   # 200
```

## 6. nginx — done (HTTP only, IP-matched, no TLS yet)

```sh
cp deploy/nginx-viraltrendly.conf /etc/nginx/sites-available/viraltrendly
ln -s /etc/nginx/sites-available/viraltrendly /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

The vhost matches `server_name 109.205.179.106` specifically (not a
catch-all `_`), so it can't intercept traffic meant for
`live.dimabac.com` or nginx's `default` site. Confirmed both dimabac and
the new site respond correctly after the reload.

## 7. Verified (2026-09-13)

- `http://109.205.179.106/` → 200, real production CSP header present (no
  `unsafe-eval` — that's `next dev`-only)
- `/admin/login` → logged in successfully with the generated credentials
- `dimabac-live`, `livekit`, `nginx`, `postgresql`, `viraltrendly` — all
  `active`; `https://live.dimabac.com/` still 200 throughout
- axe a11y audit CLEAN, responsive audit ALL CLEAN 320-1440, against the
  live IP

## Adding a domain + Cloudflare + TLS later

Skipped for now by choice, not by blocker — do this whenever ready:

1. Namecheap: point `viraltrendly.com` + `www` A records at
   `109.205.179.106`. Let it propagate.
2. Update `/srv/viraltrendly/.env`: `NEXT_PUBLIC_SITE_URL="https://viraltrendly.com"`.
3. `npm run build && sudo systemctl restart viraltrendly.service` — the
   site bakes its canonical/OG/sitemap URLs into statically generated
   pages at build time, so this rebuild is required, not optional, for
   the domain to actually take effect everywhere.
4. Replace `/etc/nginx/sites-available/viraltrendly`'s `server_name` line
   with a real domain-based vhost (apex + www redirect + TLS) — a fuller
   template for this shape existed in an earlier version of this file in
   git history if useful as a starting point.
5. `certbot --nginx -d viraltrendly.com -d www.viraltrendly.com`
6. Cloudflare: add the domain, switch nameservers at Namecheap, proxy the
   A record (orange cloud), SSL mode "Full (strict)" once step 5's cert
   is live.
7. Re-run the post-deploy smoke test (below) against the real domain over
   HTTPS, and re-run `npm run audit:perf` — the Phase 9 Lighthouse numbers
   were measured on a local dev machine against picsum.photos placeholder
   images, not representative of the real deploy.

## Periodic health check (run this after any gap of more than a few days)

Caught a real, silent bug this way on 2026-09-28 (the chown issue above) —
the site was serving 200s the whole time, nothing user-facing pointed at
it. Worth a couple of minutes before assuming "it's fine because it's up":

```sh
systemctl is-active dimabac-live livekit nginx postgresql viraltrendly
journalctl -u viraltrendly.service --since '7 days ago' | grep -iE 'error|fail|exception' | tail -60
find /srv/viraltrendly -not -user viraltrendly | head -20   # should be empty
```

A `find` result full of `node_modules`/`.next` paths means the chown-after-
build step got skipped on the last redeploy — see above. Bot-scanner noise
(`/.env.*`, `/phpinfo`, garbage Server-Action-ID POSTs, etc., all 404/
rejected) in the journal is normal background internet traffic on any
public IP, not a compromise — don't chase it.

## Post-deploy smoke test (repeat after any real content/config change)

- Homepage loads, no console errors, no mixed-content warnings once on TLS
- `/admin/login` reachable, log in works
- Submit the contact form, react to an article, submit a comment — confirm
  each lands correctly in the admin (`/admin/contact-messages`,
  `/admin/comments`)
- `curl -sI <url> | grep -i content-security-policy` — header present, no
  `unsafe-eval`
- `npm run audit` / `audit:a11y` / `audit:perf` against the real URL

## Redeploying later

```sh
cd /srv/viraltrendly
git pull   # once a remote exists — otherwise repeat the tarball step above
npm ci
npx prisma migrate deploy   # no-op if there are no new migrations
npm run build
sudo chown -R viraltrendly:viraltrendly /srv/viraltrendly   # see below — don't skip this
sudo systemctl restart viraltrendly.service
```

**Don't skip the `chown -R` step, even though step 2's first-deploy version
already did it once.** Real bug hit on 2026-09-28, ~2 weeks after the
Sep 13 redeploy that added GA4 settings: that redeploy ran `npm ci`/
`npm run build` as root over SSH and skipped re-chowning afterward, which
left `node_modules/` and the freshly-built `.next/server/app/` tree
root-owned while the service itself runs as `viraltrendly`. Next.js kept
serving 200s the whole time (not a crash), but every prerender-cache write
for a not-found dynamic path failed silently with `EACCES` — only visible
in `journalctl -u viraltrendly`, not in any user-facing symptom. Whenever
a build/install step ran as a different user than `viraltrendly`, chown
the whole tree again before restarting, every time.
