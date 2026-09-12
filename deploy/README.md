# Deploying ViralTrendly to the VPS

Target: `109.205.179.106`, shared with the unrelated `live.dimabac.com`
project. Full coexistence rules live in the `viraltrendly-vps` memory —
the short version: new files only, new port (3100), new systemd unit with
resource caps, own native Postgres, own nginx vhost, own Let's Encrypt
cert. Never touch `dimabac-live.service`, `livekit.service`,
`/etc/nginx/sites-available/live.dimabac.com`, or `default`.

This is a first-deploy runbook, not a CI pipeline — run it by hand,
checking each step before the next.

## 0. Prerequisites (once)

- DNS: point `viraltrendly.com` and `www.viraltrendly.com` A records at
  `109.205.179.106` (Namecheap). Let this propagate before step 6.
- On the VPS: Node.js (same major version as local — currently 24.x LTS),
  npm, PostgreSQL server, nginx, certbot (`python3-certbot-nginx`) —
  install whichever of these aren't already present (nginx is; Postgres
  is not, dimabac has no DB).
- Create the app's system user:
  `sudo useradd --system --no-create-home --shell /usr/sbin/nologin viraltrendly`

## 1. Database

```sh
sudo -u postgres psql -c "CREATE ROLE viraltrendly WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE viraltrendly OWNER viraltrendly;"
```

Use that same password in `/srv/viraltrendly/.env`'s `DATABASE_URL` (step 3).

## 2. Get the code onto the box

```sh
sudo mkdir -p /srv/viraltrendly
sudo chown viraltrendly:viraltrendly /srv/viraltrendly
# copy the repo in (git clone, rsync, or scp — whatever this project uses for
# source control remotes), then as the viraltrendly user:
cd /srv/viraltrendly
npm ci
```

## 3. Environment

```sh
cp .env.production.example .env
# edit .env: DATABASE_URL password, ADMIN_EMAIL, and any AdSense/analytics
# IDs you actually have. Leave the rest as-is to start.
chmod 600 .env
```

## 4. Build, migrate, seed

```sh
npm run build
npx prisma migrate deploy       # NOT `migrate dev` — this only applies
                                 # existing migrations, never prompts,
                                 # never resets anything
npm run db:seed:prod            # structural data only — categories, ad
                                 # placements, admin user, authors, tags,
                                 # legal pages. NEVER run plain `db:seed`
                                 # here: it publishes 11 fake demo
                                 # articles + fake comments + randomized
                                 # reaction counts onto the real site.
```

`db:seed:prod` prints the generated admin password to the terminal
**exactly once** — copy it immediately, then log in and change it via
`/admin` → My Account.

## 5. systemd

```sh
sudo cp deploy/viraltrendly.service /etc/systemd/system/viraltrendly.service
sudo systemctl daemon-reload
sudo systemctl enable --now viraltrendly.service
sudo systemctl status viraltrendly.service     # should be active (running)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3100/   # 200
```

## 6. nginx + TLS

```sh
sudo cp deploy/nginx-viraltrendly.conf /etc/nginx/sites-available/viraltrendly.com
sudo ln -s /etc/nginx/sites-available/viraltrendly.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d viraltrendly.com -d www.viraltrendly.com
```

certbot rewrites the 443 server block in place to point at the issued
cert — that edit is expected and permanent, don't revert it from the repo
copy on a later redeploy (copy everything except the
`ssl_certificate*`/certbot-managed lines, or just don't re-copy the file
at all once TLS is live).

## 7. Cloudflare (manual, your account)

Add the domain to Cloudflare, switch nameservers at Namecheap to
Cloudflare's, proxy the A record (orange cloud). SSL mode: "Full (strict)"
once step 6's cert is live.

## 8. Post-deploy smoke test

- `https://viraltrendly.com/` loads, no mixed-content warnings
- `/admin/login` reachable, log in with the changed password
- Submit the contact form, react to an article, submit a comment — confirm
  each in the admin (`/admin/contact-messages`, `/admin/comments`)
- `curl -sI https://viraltrendly.com/ | grep -i content-security-policy`
  — confirm the header is present and has no `unsafe-eval` (that's a
  `next dev`-only allowance, see the CSP fix commit)
- Re-run `npm run audit` / `audit:a11y` / `audit:perf` against the real
  domain instead of localhost, per the Phase 9 note that lab numbers on a
  dev machine with placeholder images aren't the real signal

## Redeploying later

```sh
cd /srv/viraltrendly
git pull   # or however new code arrives
npm ci
npm run build
npx prisma migrate deploy   # no-op if there are no new migrations
sudo systemctl restart viraltrendly.service
```
