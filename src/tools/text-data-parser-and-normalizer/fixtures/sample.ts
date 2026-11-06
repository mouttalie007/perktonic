/** Loaded when the page opens: a support thread with every category, duplicates and tricky cases. */
export const SAMPLE = `From: Ada Lovelace <ada.lovelace+billing@example.co.uk>
Cc: Support@Example.co.uk, josé@correo.españa.es
Date: 28/10/2026 09:14

Hi team, following up on order #A-1042 from 3 March 2026 (invoice dated 2026-03-05).
The refund of €1.234,56 (about $1,342.10 or GBP 1,078.00) is still pending since Oct 12, 2026.
Please call me on +44 20 7946 0958 or on my mobile 07812 345678; our US office is +1 (212) 555-0147.
Pay to IBAN GB82 WEST 1234 5698 7654 32 (not GB82 WEST 1234 5698 7654 33, which has a typo).

Logs show the webhook hitting 203.0.113.42 and 2001:0db8:0000:0000:0000:ff00:0042:8329, then failing.
Docs: www.example.com/help/refunds and https://status.example.com/incidents?id=77.
Thanks! @ada_support @Ada_Support #Refunds #refunds #Q4
ada.lovelace+billing@EXAMPLE.co.uk`;
