/** "Try an example" cycles through these. The first is the main demo (JSON POST with auth). */
export const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "JSON POST with a token",
    text: `curl -X POST https://api.example.com/v1/orders \\
  -H "Authorization: Bearer sk_test_51Hx9" \\
  -H "Content-Type: application/json" \\
  -d '{"customer_id": 4182, "items": [{"sku": "MUG-01", "qty": 2}], "gift": false, "note": null}'`,
  },
  {
    label: "Form login with basic auth and -L",
    text: `curl -sSL -u admin:'s3cr3t!' --data-urlencode "comment=Hello & welcome" -d team=ops https://intranet.example.org/login`,
  },
  {
    label: "Multipart upload",
    text: `curl -F "title=Q3 report" -F "file=@./report.pdf;type=application/pdf" -k --max-time 30 https://files.example.net/upload`,
  },
  {
    label: "Python requests to curl",
    text: `import requests

headers = {"Accept": "application/json", "X-Api-Key": "abc123"}
params = {"q": "coffee mugs", "page": 2}
response = requests.get("https://api.example.com/search", headers=headers, params=params, timeout=10)
print(response.json())`,
  },
];
