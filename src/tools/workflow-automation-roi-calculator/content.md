---
title: "Workflow Automation ROI Calculator with Break-Even Chart"
metaDescription: "A free workflow automation roi calculator: enter task time, people and costs to get hours saved, payback period, first-year and 3-year ROI, with a chart."
h1: "Workflow Automation ROI Calculator"
---

## Hero

This workflow automation ROI calculator shows how much time and money automating a repetitive task saves. It gives the payback period and first-year and 3-year ROI, and draws a break-even chart, with every formula on the page.

## How to use

1. Enter how often the task happens per person (per day, week or month) and how many minutes it takes.
2. Enter how many people do it and what an hour of their time costs.
3. Enter the one-off build cost and the monthly tool or maintenance cost, and pick your currency.
4. Read the results and the break-even chart. Switch between yearly and monthly figures.
5. Copy a share link, copy the summary, download the month-by-month CSV or print the report.

## Examples

**Invoice data entry** (loaded when the page opens). Three people each key in 20 invoices a day, at 4 minutes each. They cost $35 an hour, and an extraction tool would remove 90% of the work. It costs $6,000 to set up and $150 a month.

```
Tasks per year      20 × 230 working days × 3 people = 13,800
Hours saved         13,800 × 4 min × 90% ÷ 60 = 828 h
Savings             828 h × $35 = $28,980 per year
After running cost  $28,980 − $1,800 = $27,180 per year
Payback             $6,000 ÷ $2,265 per month = 2.6 months
First-year ROI      272%      3-year ROI 663% (net $75,540)
```

**A weekly report.** One person spends 20 minutes on a status report every week, at €40 an hour. Automating it costs €1,500 plus €49 a month. The savings are €693 a year and the running cost is €588, so payback takes 14.2 years. At €60 a month the calculator says "Never pays back", because the subscription costs more than the time it saves.

**Payroll checks in dirhams.** Two people check payroll twice a month, at 3 hours each and MAD 120 an hour. A script that removes 75% of the work costs MAD 15,000 and nothing per month. It saves 108 hours (MAD 12,960) a year and pays back in 13.9 months.

## Tips and limits

- **Frequency is per person.** "20 per day" with 3 people means 60 tasks a day in total. Daily tasks use the working days per year (230 by default, editable), weekly tasks use 52 weeks, and monthly tasks use 12 months.
- **The automated share** is there because few automations remove every manual step. Enter 70% if someone still checks each result.
- **ROI** is (savings − cost) ÷ cost over the period. Year 1 counts the build cost plus 12 months of running cost. Three years count the build cost plus 36 months. With no cost at all, ROI cannot be calculated, and the page says "Not defined".
- **Zero values are allowed.** Negative or non-numeric values show a message next to the field. A task with no savings, or one whose running cost is at least as large as the savings, is reported as never paying back; no division by zero takes place.
- **The share link** puts the inputs after the `#` in the address, for example `#n=20&per=day&rate=35`. Browsers do not send that part to any server.
- **Not included:** taxes, discounting, wage rises, or the time it takes people to adopt the tool. Time saved only becomes money if it is used for other work or replaces paid hours.

## FAQ

**How is automation ROI calculated?**
Hours saved per year × hourly cost gives the gross savings. ROI compares those savings with the build cost and the running cost for the same period: (savings − cost) ÷ cost × 100.

**What counts as automation cost?**
Everything you pay to get it running: development or consultant time, setup, and training. On top of that come recurring costs such as subscriptions, API usage, hosting and the hours spent maintaining it.

**How long until it pays off?**
Divide the build cost by the monthly savings left after running costs. In the invoice example that is $6,000 ÷ $2,265 = 2.6 months. If nothing is left after running costs, it never pays back.

**Which hourly cost should I use?**
Use the loaded cost: salary plus taxes, benefits and overhead. That is often 1.3 to 1.5 times the gross hourly wage.

**Can I share or print the result?**
Yes. "Copy share link" gives a URL that reopens the calculator with the same numbers. "Print report" prints the results, chart and formulas without the form.

## Privacy note

All calculations run in your browser and nothing you enter is sent to a server or stored. A share link holds the numbers in the part of the address after `#`, which stays between you and the people you send it to.
