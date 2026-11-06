// "Hide account numbers before sending": IBANs and long digit runs keep only their last 4 digits.
// The masked text is what is sent and what the quotes are checked against.

const IBAN = /\b([A-Z]{2}\d{2})((?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,3})?)\b/g;
/** 10 or more digits, possibly grouped by single spaces or dashes (card and account numbers). */
const LONG = /\b\d(?:[ -]?\d){9,}\b/g;

const hide = (s: string) => {
  const total = s.replace(/[^A-Z0-9]/gi, "").length;
  let seen = 0;
  return s.replace(/[A-Z0-9]/gi, (c) => (++seen > total - 4 ? c : "X"));
};

export function maskAccounts(text: string): { text: string; count: number } {
  let count = 0;
  const out = text
    .replace(IBAN, (_m, head: string, rest: string) => {
      count++;
      return head + hide(rest);
    })
    .replace(LONG, (m) => {
      count++;
      return hide(m);
    });
  return { text: out, count };
}
