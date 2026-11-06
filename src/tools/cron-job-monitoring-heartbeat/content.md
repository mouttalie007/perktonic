---
title: "Cron Job Monitoring Heartbeat: Free Ping URL Alerts"
metaDescription: "Cron job monitoring heartbeat: give each job a ping URL and get one webhook alert when a run is missed or fails, plus one when it recovers."
h1: "Cron Job Monitoring Heartbeat"
---
## Hero
Cron job monitoring heartbeat with no account: your job calls a ping URL after each successful run. If the ping does not arrive on time, you get one alert on your webhook, and one more when the job recovers.

## How to use
1. Name the job and set how often it runs (from 1 minute to 7 days). Then set a grace period (from 1 minute to 1 day) for runs that are a little slow.
2. Add the webhook URL that should receive the alert (a JSON POST).
3. Press **Create monitor**. You get two secret links: the **ping URL** and your **private dashboard link**. Keep the dashboard link: there is no account and no recovery.
4. Add the ping to your job, for example `backup.sh && curl -fsS -m 10 --retry 3 <ping URL>`.
5. Optionally call `<ping URL>/start` before the job, to see how long it runs. Call `<ping URL>/fail` with a short message when it fails.
6. Open the dashboard link to see the state, the last 50 pings and the last 50 events. From there you can pause, resume, send a test alert or delete the monitor.

## Examples
**A nightly backup at 02:00, expected every 1 day with a 30-minute grace period.**
- The job pings at 02:04 every night, so the state is **Up**.
- One night the server is off. At 02:04 the next day the state turns **Late**, and at 02:34 it turns **Down**. One alert is sent to your webhook, and no more while it stays down.
- The next morning a ping arrives, the state is back to Up, and one "recovered" alert is sent.

**A failing export.** The script runs `curl --data-raw "disk full" <ping URL>/fail`. The monitor turns Down at once, and the alert includes "disk full".

**A webhook alert.** The webhook receives a JSON POST such as `{"monitor":"Nightly backup","event":"down","lastPingAt":"2026-11-03T02:04:11Z"}`. If it fails, we try 3 times with growing waits and show the last result on the dashboard.

## Tips and limits
- States: **New** (no ping yet), **Up**, **Late** (the interval has passed, still within the grace period) and **Down**.
- Ping URLs accept GET, POST and HEAD and answer `ok` at once.
- Pings closer than 10 seconds apart are accepted but not recorded, and each URL accepts 60 pings a minute.
- You can create 3 monitors per day. A monitor that is never pinged is removed after 7 days, and one with no ping for 90 days is removed too.
- Times are stored in UTC and shown in your time zone.
- Telegram alerts appear only when they are enabled on this site.

## FAQ
**How does a cron heartbeat monitor work?**
Your job calls a unique URL when it finishes. We expect that call every interval; when it is missing after the grace period, we alert you. It catches jobs that crash, hang or never start.

**What happens if my job is late?**
During the grace period the state is Late and nothing is sent. If no ping arrives before the grace period ends, the state becomes Down and one alert goes out.

**Is it free?**
Yes, with no account. The limits keep it fair: 3 new monitors per day per address, and unused monitors are removed.

**Will I get an alert every 30 seconds while it is down?**
No. You get one alert when it goes down and one when it recovers.

**What if I lose the dashboard link?**
It cannot be recovered, because we store only a fingerprint (SHA-256) of each link. Create a new monitor and update your job.

**Can I delete a monitor?**
Yes: delete it from the dashboard at any time, and everything stored about it is removed.

## Privacy note
We store the monitor's name, its settings, the alert webhook URL (if you add one) and the ping times, and nothing else. The secret links are stored only as fingerprints. Unused monitors are removed: never pinged after 7 days, or not pinged for 90 days. Deleting a monitor removes its pings and events at once.
