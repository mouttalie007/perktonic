import type { ComponentType, SVGProps } from "react";
import { SITE, SOCIAL_PLATFORMS, type SocialPlatform } from "@/config/site";
import {
  FacebookIcon,
  XIcon,
  InstagramIcon,
  YoutubeIcon,
  TiktokIcon,
} from "@/components/icons";

const ICONS: Record<
  SocialPlatform,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  facebook: FacebookIcon,
  x: XIcon,
  instagram: InstagramIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
};

/**
 * Social icon row. Only the platforms with a configured URL are shown (greyed-out icons that
 * go nowhere look broken); with none configured nothing is rendered. The Admin Dashboard sets
 * the real URLs (SiteSettings).
 */
export function SocialLinks({
  links,
  size = 16,
  className = "",
  linkClassName = "",
}: {
  links: Partial<Record<SocialPlatform, string>>;
  size?: number;
  className?: string;
  linkClassName?: string;
}) {
  const shown = SOCIAL_PLATFORMS.filter(({ key }) => links[key]?.trim());
  if (shown.length === 0) return null;
  return (
    <ul className={`flex items-center gap-1 ${className}`}>
      {shown.map(({ key, label }) => {
        const Icon = ICONS[key];
        return (
          <li key={key}>
            <a
              href={links[key]!.trim()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${SITE.shortName} on ${label}`}
              className={`inline-flex items-center justify-center rounded-sm p-1.5 transition-colors ${linkClassName}`}
            >
              <Icon width={size} height={size} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
