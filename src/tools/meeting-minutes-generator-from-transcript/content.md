---
title: "Meeting Minutes Generator from Transcript: Free Online"
metaDescription: "Meeting minutes generator from transcript: paste a transcript or open a VTT, SRT or Word file and get attendees, decisions, action items and open questions."
h1: "Meeting Minutes Generator from Transcript"
---
## Hero
Paste a meeting transcript, or open the .vtt, .srt, .txt or .docx file your meeting app exported. This meeting minutes generator from transcript returns attendees, agenda topics, decisions, action items and open questions, each backed by the sentence that was said.

## How to use
1. Paste the transcript (up to 60,000 characters, about 60 to 90 minutes of talk) or open a file. Subtitle files are turned into clean text with speaker names.
2. Optionally add the meeting title and date. Choose the language of the minutes; by default they are written in the language of the transcript.
3. Check "Count deadlines from". It is today's date for your own transcript; "next Friday" and "end of the month" are counted from it.
4. Press **Write minutes**.
5. Review the lists. Every decision, action item and open question shows the sentence it came from.
6. Download Markdown or Word, download the action items as CSV, or copy the minutes or the checklist.

## Examples
**A weekly product sync, reference date Monday 2 November 2026:**
- "Lena Park: I'll update the pricing page copy by Wednesday." This becomes an action item for Lena Park, due 2026-11-04, because a promise a speaker makes about themselves is a task with that speaker as owner.
- "Sam, can you collect the slowest login traces before next Friday?" Sam Okafor is the owner, due 2026-11-13: the Friday of the following week.
- "Someone needs to renew the support domain before the end of the month." The owner is **Unassigned** and the task is due 2026-11-30.

**A call with "Speaker 1", "Speaker 2" labels.** The attendees are listed as those labels. No real names are invented.

**A deadline of "sometime next quarter".** The due date stays empty and the words are kept, because the tool does not guess a date.

## Tips and limits
- **Text only.** There is no audio upload and no speech-to-text in this version. Export the transcript from your meeting app (most can save .vtt or .txt) and open it here.
- Speaker names are used only when they are in the transcript. An attendee or an owner whose name is not in the text is removed.
- Items whose quoted sentence is not in the transcript are removed, and the page says how many.
- A due date more than 5 years away, or one that is not a valid date, is removed; the deadline words stay.
- The title and the date come from the form, or from the transcript itself, and are never made up.
- 60,000 characters per request. Longer meetings are refused, not cut: send them in parts.
- Timestamps from subtitle files can be kept as [mm:ss] if you tick the option.

## FAQ
**How do I write meeting minutes quickly?**
Export or copy the transcript from your meeting app, paste it here and press Write minutes. Check the action items and their owners, then download or copy the result.

**Does it identify speakers?**
It uses the speaker labels in your transcript ("Ana:" or the `<v Ana>` tags of WebVTT). It cannot tell voices apart, because it never hears the audio.

**What audio formats work?**
None in this version: the tool reads text transcripts only (.txt, .vtt, .srt, .docx or pasted text). Transcribe the recording first, for example with your meeting app.

**Are decisions and action items separate?**
Yes. Decisions are what was agreed, action items are tasks someone will do, and open questions are what was left unanswered. Each is a separate list.

**Can I write the minutes in another language?**
Yes. Choose English, French, German, Spanish, Italian, Portuguese, Dutch or Arabic. Quotes stay in the language that was spoken.

**How many meetings can I convert?**
10 AI requests per 10 minutes, and each meeting is one request.

## Privacy note
Recordings and transcripts contain personal data: make sure everyone who was recorded knows about the recording and this use of it. When you press Write minutes, the transcript and the form are sent to our server and to the AI provider to produce the minutes. Files are read in your browser first. We do not store the transcript with your identity, and identical requests may be answered from a short-lived cache.
