import type { PromptInput } from "../src/llm/prompt";

export const sampleInput: PromptInput = {
  "transcript": "[00:00] Priya Shah: Okay, let's start. This is the weekly product sync for the mobile app, 2 November 2026. Marco, Sam and Lena are here.\n[00:12] Marco Rossi: Quick update on pricing. The annual plan page is ready except the copy.\n[00:25] Priya Shah: Good. Then we agree to launch the annual plan on 16 November.\n[00:31] Lena Park: Agreed. I'll update the pricing page copy by Wednesday.\n[00:40] Sam Okafor: On crash reports: Android crashes went from 1.9% to 0.7% of sessions after release 4.2.\n[00:55] Priya Shah: Great. Sam, can you collect the slowest login traces before next Friday?\n[01:02] Sam Okafor: Yes, I'll do that.\n[01:10] Marco Rossi: One thing nobody knows yet: do we keep the monthly discount after the annual plan launches?\n[01:18] Priya Shah: Let's leave that open and ask finance. Someone needs to renew the support domain before the end of the month.\n[01:30] Priya Shah: That's all, thanks everyone.",
  "title": "",
  "date": "",
  "language": "auto",
  "referenceDate": "2026-11-02"
};
