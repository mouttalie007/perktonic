/** Cities people search for, mapped to their IANA zone. Every IANA zone is searchable too. */
export const CITIES: [string, string][] = [
  ["New York", "America/New_York"], ["Boston", "America/New_York"], ["Toronto", "America/Toronto"], ["Miami", "America/New_York"],
  ["Chicago", "America/Chicago"], ["Dallas", "America/Chicago"], ["Austin", "America/Chicago"], ["Mexico City", "America/Mexico_City"],
  ["Denver", "America/Denver"], ["Phoenix", "America/Phoenix"], ["Los Angeles", "America/Los_Angeles"], ["San Francisco", "America/Los_Angeles"],
  ["Seattle", "America/Los_Angeles"], ["Vancouver", "America/Vancouver"], ["Anchorage", "America/Anchorage"], ["Honolulu", "Pacific/Honolulu"],
  ["St. John's", "America/St_Johns"], ["Halifax", "America/Halifax"], ["Bogotá", "America/Bogota"], ["Lima", "America/Lima"],
  ["Santiago", "America/Santiago"], ["Caracas", "America/Caracas"], ["Buenos Aires", "America/Argentina/Buenos_Aires"], ["São Paulo", "America/Sao_Paulo"],
  ["Rio de Janeiro", "America/Sao_Paulo"], ["Montevideo", "America/Montevideo"], ["Reykjavík", "Atlantic/Reykjavik"], ["Lisbon", "Europe/Lisbon"],
  ["London", "Europe/London"], ["Dublin", "Europe/Dublin"], ["Madrid", "Europe/Madrid"], ["Barcelona", "Europe/Madrid"],
  ["Paris", "Europe/Paris"], ["Brussels", "Europe/Brussels"], ["Amsterdam", "Europe/Amsterdam"], ["Berlin", "Europe/Berlin"],
  ["Munich", "Europe/Berlin"], ["Zurich", "Europe/Zurich"], ["Vienna", "Europe/Vienna"], ["Milan", "Europe/Rome"],
  ["Rome", "Europe/Rome"], ["Copenhagen", "Europe/Copenhagen"], ["Stockholm", "Europe/Stockholm"], ["Oslo", "Europe/Oslo"],
  ["Warsaw", "Europe/Warsaw"], ["Prague", "Europe/Prague"], ["Budapest", "Europe/Budapest"], ["Athens", "Europe/Athens"],
  ["Helsinki", "Europe/Helsinki"], ["Bucharest", "Europe/Bucharest"], ["Kyiv", "Europe/Kyiv"], ["Istanbul", "Europe/Istanbul"],
  ["Moscow", "Europe/Moscow"], ["Casablanca", "Africa/Casablanca"], ["Lagos", "Africa/Lagos"], ["Accra", "Africa/Accra"],
  ["Cairo", "Africa/Cairo"], ["Johannesburg", "Africa/Johannesburg"], ["Cape Town", "Africa/Johannesburg"], ["Nairobi", "Africa/Nairobi"],
  ["Addis Ababa", "Africa/Addis_Ababa"], ["Algiers", "Africa/Algiers"], ["Tunis", "Africa/Tunis"], ["Tel Aviv", "Asia/Jerusalem"],
  ["Jerusalem", "Asia/Jerusalem"], ["Amman", "Asia/Amman"], ["Beirut", "Asia/Beirut"], ["Riyadh", "Asia/Riyadh"],
  ["Doha", "Asia/Qatar"], ["Dubai", "Asia/Dubai"], ["Abu Dhabi", "Asia/Dubai"], ["Tehran", "Asia/Tehran"],
  ["Kabul", "Asia/Kabul"], ["Karachi", "Asia/Karachi"], ["Lahore", "Asia/Karachi"], ["Mumbai", "Asia/Kolkata"],
  ["Delhi", "Asia/Kolkata"], ["Bengaluru", "Asia/Kolkata"], ["Bangalore", "Asia/Kolkata"], ["Chennai", "Asia/Kolkata"],
  ["Kolkata", "Asia/Kolkata"], ["Colombo", "Asia/Colombo"], ["Kathmandu", "Asia/Kathmandu"], ["Dhaka", "Asia/Dhaka"],
  ["Yangon", "Asia/Yangon"], ["Bangkok", "Asia/Bangkok"], ["Ho Chi Minh City", "Asia/Ho_Chi_Minh"], ["Jakarta", "Asia/Jakarta"],
  ["Kuala Lumpur", "Asia/Kuala_Lumpur"], ["Singapore", "Asia/Singapore"], ["Manila", "Asia/Manila"], ["Hong Kong", "Asia/Hong_Kong"],
  ["Shanghai", "Asia/Shanghai"], ["Beijing", "Asia/Shanghai"], ["Shenzhen", "Asia/Shanghai"], ["Taipei", "Asia/Taipei"],
  ["Seoul", "Asia/Seoul"], ["Tokyo", "Asia/Tokyo"], ["Osaka", "Asia/Tokyo"], ["Perth", "Australia/Perth"],
  ["Adelaide", "Australia/Adelaide"], ["Darwin", "Australia/Darwin"], ["Brisbane", "Australia/Brisbane"], ["Sydney", "Australia/Sydney"],
  ["Melbourne", "Australia/Melbourne"], ["Auckland", "Pacific/Auckland"], ["Wellington", "Pacific/Auckland"], ["Chatham Islands", "Pacific/Chatham"],
];

export interface ZoneOption {
  label: string;
  zone: string;
}

/** Matches city names first, then IANA zone names ("Kolkata", "asia/kat", "new york"). */
export function searchZones(query: string, allZones: string[], limit = 12): ZoneOption[] {
  const q = query.trim().toLowerCase().replace(/_/g, " ");
  if (q === "") return [];
  const out: ZoneOption[] = [];
  const seen = new Set<string>();
  const push = (label: string, zone: string) => {
    const key = `${label}|${zone}`;
    if (seen.has(key) || out.length >= limit) return;
    seen.add(key);
    out.push({ label, zone });
  };
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const nq = norm(q);
  for (const [city, zone] of CITIES) if (norm(city).startsWith(nq)) push(city, zone);
  for (const [city, zone] of CITIES) if (norm(city).includes(nq)) push(city, zone);
  for (const zone of allZones) {
    const z = norm(zone.replace(/_/g, " "));
    if (z.includes(nq)) push(zone.split("/").pop()!.replace(/_/g, " "), zone);
  }
  return out;
}
