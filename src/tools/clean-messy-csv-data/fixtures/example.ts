/** Used by "Try an example": a typical export with stray spaces, invisible characters, smart quotes, placeholders, duplicates and two date columns. */
export const EXAMPLE_CSV = [
  " Customer Name ,Email,Signup Date,Renewal,Plan,Monthly Fee",
  "  Ana Souza ,ana.souza@example.com,25/03/2026,03/04/2026,Pro,49",
  "Liam O’Brien,liam.obrien@example.com,02/03/2026,05/06/2026,“Starter”,N/A",
  "Ana Souza,ana.souza@example.com,25/03/2026,03/04/2026,Pro,49",
  "Chen Wei,chen.wei@example.com​,14/02/2026,01/02/2027,Team,120",
  ",,,,,",
  "Fatima Zahra,fatima.z@example.com,7 Jan 2026,-,Pro,49",
].join("\n");
