/** Used by "Try an example" (CSV → JSON). Zip codes with leading zeros, a nested address and a multi-line note. */
export const EXAMPLE_CSV = [
  "id,name,email,address.city,address.zip,newsletter,lifetime_value,notes",
  "1001,\"Nguyen, Linh\",linh.nguyen@example.com,Boston,02134,true,1249.50,",
  "1002,Marco Rossi,marco.rossi@example.com,Austin,73301,false,310,\"Prefers email\nafter 5 pm\"",
  "1003,Aisha Bello,aisha.bello@example.com,Newark,07102,true,null,\"Said \"\"call me\"\" twice\"",
].join("\n");

/** Used by "Try an example" (JSON → CSV): a typical API response. */
export const EXAMPLE_JSON = JSON.stringify(
  {
    data: [
      { id: "ord_8812", total: 54.9, paid: true, customer: { name: "Kofi Mensah", country: "GH" }, items: ["mug", "tea"] },
      { id: "ord_8813", total: 120, paid: false, customer: { name: "Elif Yılmaz", country: "TR" }, items: ["kettle"] },
      { id: "ord_8814", total: 9.5, paid: true, customer: { name: "Jonas \"JJ\" Berg", country: "SE" }, items: [] },
    ],
  },
  null,
  2,
);
