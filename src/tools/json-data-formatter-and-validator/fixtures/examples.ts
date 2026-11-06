/** "Try an example": a webhook-style order with a 64-bit ID that JSON.parse would round. */
export const EXAMPLE_JSON = `{"id":9007199254740993,"status":"paid","total":129.90,"currency":"EUR","customer":{"name":"Léa Martin","email":"lea.martin@example.com"},"items":[{"sku":"MUG-01","qty":2,"price":14.95},{"sku":"TEA-GR","qty":1,"price":100.00}],"tags":["web","first-order"],"coupon":null}`;

/** A 2020-12 schema the example passes. */
export const EXAMPLE_SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["id", "status", "items"],
  "properties": {
    "id": { "type": "integer" },
    "status": { "enum": ["pending", "paid", "refunded"] },
    "total": { "type": "number", "minimum": 0 },
    "customer": {
      "type": "object",
      "required": ["email"],
      "properties": { "email": { "type": "string", "format": "email" } }
    },
    "items": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["sku", "qty"],
        "properties": { "sku": { "type": "string" }, "qty": { "type": "integer", "minimum": 1 } }
      }
    }
  }
}`;

/** The same order broken in typical ways: missing comma (line 4), single quotes, trailing comma. */
export const BROKEN_JSON = `{
  "id": 1042,
  "status": "paid"
  "total": 129.9
}`;

export const JSONC = `{
  // settings for the export job
  "format": "csv",
  "columns": ["id", "email",], /* trailing comma above */
}`;

export const DRAFT7_SCHEMA = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "port": { "type": "integer", "maximum": 65535 },
    "hosts": { "type": "array", "items": { "type": "string" }, "minItems": 1 }
  },
  "required": ["port", "hosts"],
  "additionalProperties": false
}`;
