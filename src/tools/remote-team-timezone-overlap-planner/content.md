---
title: "Remote Team Timezone Overlap Planner: Best Meeting Times"
metaDescription: "A remote team timezone overlap planner: enter each person's city and hours to see the shared window, daylight saving changes and a shareable link."
h1: "Remote Team Timezone Overlap Planner"
---

## Hero

This remote team timezone overlap planner finds the hours when everyone on your team is at work. Enter each person's city and working hours to get the best meeting slots, a 24-hour grid and a link you can share.

## How to use

1. Add a row for each person: a name or role, their city or time zone, and their working hours and days.
2. Pick the date to plan and the time zone to view the results in (UTC, or any team member's zone).
3. Choose the shortest meeting that is useful to you, from 15 minutes to 2 hours.
4. Read the best windows. Each one is listed in every person's local time and says who is within working hours.
5. Copy the share link or a text summary, or download a window as an `.ics` calendar event.

## Examples

**A five-city product team** (the "Try an example" button). On Wednesday 28 October 2026 the team is Maya in New York (08:00–16:00), Tom in London (09:00–17:30), Lena in Berlin (09:00–17:00), Arjun in Mumbai (12:00–21:00) and Sita in Kathmandu (12:00–20:00). The tool answers: "12:00–14:15 UTC (08:00–10:15 New York, 12:00–14:15 London, 13:00–15:15 Berlin, 17:30–19:45 Kolkata, 17:45–20:00 Kathmandu): everyone is within working hours." That is 2 h 15 min of shared time.

**The daylight saving trap.** The same plan shows a note: "Daylight saving ahead: from 2026-11-04 the shared time shrinks to 1 h 15 min." Europe set its clocks back on 25 October, but the United States waits until 1 November. A week later Maya starts at 13:00 UTC instead of 12:00, so the team loses an hour.

**A support rota with a night shift.** Someone in Manila working 22:00–06:00 is entered as starting 22:00 and ending 06:00. The tool marks the row "Overnight: ends the next day" and counts the hours after midnight towards the following morning.

## Tips and limits

- Time zones come from your browser's own IANA database (the one behind `Intl`), so rules such as India's UTC+5:30 and Nepal's UTC+5:45 are exact. Slots are 15 minutes, which lines up with every real offset.
- Daylight saving is handled per person. On a spring-forward day, a start time that does not exist (for example 02:30) moves to the first valid time, with a note. On the day clocks go back, the view day has 25 hours, and a repeated time is never counted twice.
- When nobody overlaps fully, the tool lists the best partial windows and names who would be outside working hours.
- The weekly outlook checks the same weekday for the next 12 weeks and flags any change in the shared time.
- City search covers about 110 major cities and every IANA zone name. Search by the zone if your city is missing; the nearest large city in the same country usually shares its zone.
- Up to 30 people per plan.

## FAQ

**How do I find a meeting time across time zones?**
List each person's working hours in their own local time, then look for the stretch where all of them overlap. This tool does that every 15 minutes across the day and ranks the windows by length.

**Does it handle daylight saving?**
Yes. Every slot is converted with the rules for that exact date, so dates on either side of a clock change give different answers. The outlook warns you when an upcoming change will shrink or grow your shared hours.

**Can I share the plan?**
Yes. "Copy share link" puts the whole plan in the part of the address after `#`. Browsers do not send that part to any server, so the link works without an account and nothing is stored on our side.

**What if there is no time when everyone is working?**
You will see the windows with the most people available and who is missing from each. Common fixes are a rotating meeting time or splitting into two regional calls.

**Why does Kathmandu show quarter hours?**
Nepal uses UTC+5:45, so an hour that starts on the hour in London starts at 45 minutes past in Kathmandu.

**Can I put the meeting in my calendar?**
Yes. "Download .ics" saves the window as a calendar event in UTC, which calendar apps convert to each person's local time.

## Privacy note

The planner runs entirely in your browser. Names, cities and hours are not sent anywhere or saved by us. The share link holds the plan in the URL fragment, so the plan travels only with the link you choose to share. Anyone with the link can read the names in it, so use roles instead of full names if that matters.
