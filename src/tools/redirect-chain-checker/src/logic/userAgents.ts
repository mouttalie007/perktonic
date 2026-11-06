export const USER_AGENTS = {
  default: { label: "PerkTonic checker (default)", value: undefined },
  googlebot: {
    label: "Googlebot (smartphone)",
    value: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  },
  bingbot: { label: "Bingbot", value: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" },
  chrome: {
    label: "Chrome on Windows",
    value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  },
  iphone: {
    label: "Safari on iPhone",
    value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
  },
} as const satisfies Record<string, { label: string; value: string | undefined }>;

export type UserAgentId = keyof typeof USER_AGENTS;
export const USER_AGENT_IDS = Object.keys(USER_AGENTS) as [UserAgentId, ...UserAgentId[]];
