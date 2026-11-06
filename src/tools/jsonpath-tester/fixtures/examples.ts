/** A small order export, used by "Try an example", the example lists and the tests. */
export const SAMPLE_JSON = `{
  "store": "Northwind Mugs",
  "exported_at": "2026-10-28T09:15:00Z",
  "orders": [
    {
      "id": "ORD-1042",
      "status": "shipped",
      "total": 54.5,
      "customer": { "name": "Ada Lovelace", "email": "ada@example.com", "country": "GB" },
      "items": [
        { "sku": "MUG-01", "name": "Classic mug", "qty": 2, "price": 12.0 },
        { "sku": "TEA-07", "name": "Earl Grey, 100 g", "qty": 1, "price": 30.5 }
      ]
    },
    {
      "id": "ORD-1043",
      "status": "pending",
      "total": 18.0,
      "customer": { "name": "Grace Hopper", "email": "grace@example.org", "country": "US" },
      "items": [
        { "sku": "MUG-02", "name": "Travel mug", "qty": 1, "price": 18.0 }
      ]
    },
    {
      "id": "ORD-1044",
      "status": "shipped",
      "total": 126.0,
      "customer": { "name": "Katherine Johnson", "email": "kj@example.com", "country": "US" },
      "items": [
        { "sku": "MUG-01", "name": "Classic mug", "qty": 6, "price": 12.0 },
        { "sku": "SET-03", "name": "Gift set", "qty": 1, "price": 54.0 }
      ],
      "gift": true
    }
  ]
}
`;

export const EXAMPLES: { jsonpath: { label: string; expression: string }[]; jq: { label: string; expression: string }[] } = {
  jsonpath: [
    { label: "Names of customers with shipped orders", expression: "$.orders[?(@.status == 'shipped')].customer.name" },
    { label: "Every SKU, at any depth", expression: "$..sku" },
    { label: "Items that cost more than 20", expression: "$..items[?(@.price > 20)].name" },
    { label: "The last order", expression: "$.orders[-1:]" },
    { label: "First two order IDs", expression: "$.orders[:2].id" },
    { label: "Orders marked as gifts", expression: "$.orders[?(@.gift)].id" },
  ],
  jq: [
    { label: "Names of customers with shipped orders", expression: ".orders[] | select(.status == \"shipped\") | .customer.name" },
    { label: "Orders sorted by total, largest first", expression: "[.orders[] | {id, total}] | sort_by(.total) | reverse" },
    { label: "Revenue per country", expression: ".orders | group_by(.customer.country) | map({country: .[0].customer.country, revenue: (map(.total) | add)})" },
    { label: "Mugs sold", expression: "[.orders[].items[] | select(.sku | startswith(\"MUG\")) | .qty] | add" },
    { label: "CSV lines (turn on raw output)", expression: ".orders[] | [.id, .customer.email, .total] | @csv" },
    { label: "Count orders by status", expression: "reduce .orders[] as $o ({}; .[$o.status] += 1)" },
  ],
};
