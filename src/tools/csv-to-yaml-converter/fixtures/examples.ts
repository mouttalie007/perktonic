import type { Format } from "../src/logic/options";

/** One sample per input format; the CSV one is loaded when the page opens. */
export const SAMPLES: Record<Format, string> = {
  csv: `hostname,ip,port,enabled,location.city,location.rack,tags[],owner,notes
web-01,10.0.4.11,443,true,Frankfurt,R12,frontend|public,platform,
web-02,10.0.4.12,443,true,Frankfurt,R12,frontend|public,platform,"Drains at 02:00 UTC: ""maintenance"""
db-01,10.0.8.21,5432,false,Dublin,R03,database,data-team,"Replica lag alerts:
page the on-call"
cache-01,10.0.9.5,6379,true,Dublin,R04,,platform,007 is the asset tag
`,
  yaml: `defaults: &defaults
  region: eu-west-1
  backup: true
servers:
  - name: web-01
    <<: *defaults
    ports: [80, 443]
    motd: |
      Welcome to web-01.
      Changes are logged.
  - name: db-01
    <<: *defaults
    backup: false
    ports: [5432]
    motd: null
`,
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="bk101" lang="en">
    <title>XML Developer's Guide</title>
    <price>44.95</price>
    <author><first>Matthew</first><last>Gambardella</last></author>
    <in_stock>true</in_stock>
  </book>
  <book id="bk102" lang="fr">
    <title>Midnight &amp; Rain</title>
    <price>5.95</price>
    <author><first>Kim</first><last>Ralls</last></author>
    <in_stock>false</in_stock>
  </book>
</catalog>
`,
  toml: `title = "Release plan"

[[release]]
version = "2.4.0"
date = 2026-11-03
stable = true
features = ["dark mode", "export"]

[release.owner]
name = "Ana"
team = "web"

[[release]]
version = "2.5.0-beta"
date = 2026-12-01
stable = false
features = ["sync"]

[release.owner]
name = "Ben"
team = "mobile"
`,
};
