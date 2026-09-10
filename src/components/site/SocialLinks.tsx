import type { ComponentType, SVGProps } from "react";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/config/site";
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
 * Social icon row. Renders every platform; ones without a configured URL are
 * shown disabled rather than as dead links (spec §74, §90). The Admin
 * Dashboard sets the real URLs (SiteSettings).
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
  return (
    <ul className={`flex items-center gap-1 ${className}`}>
      {SOCIAL_PLATFORMS.map(({ key, label }) => {
        const href = links[key]?.trim();
        const Icon = ICONS[key];
        return (
          <li key={key}>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`ViralTrendly on ${label}`}
                className={`inline-flex items-center justify-center rounded-sm p-1.5 transition-colors ${linkClassName}`}
              >
                <Icon width={size} height={size} />
              </a>
            ) : (
              <span
                aria-hidden="true"
                className={`inline-flex items-center justify-center p-1.5 opacity-30 ${linkClassName}`}
              >
                <Icon width={size} height={size} />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
