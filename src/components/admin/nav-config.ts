import type { Route } from "next";
import type { Role } from "@prisma/client";

export interface AdminNavItem {
  label: string;
  href: Route;
  minRole?: Role;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/admin" as Route }],
  },
  {
    title: "Content",
    items: [
      { label: "Articles", href: "/admin/articles" as Route },
      { label: "Categories", href: "/admin/categories" as Route },
      { label: "Tags", href: "/admin/tags" as Route },
      { label: "Authors", href: "/admin/authors" as Route },
      { label: "Pages", href: "/admin/pages" as Route },
      { label: "Media Library", href: "/admin/media" as Route },
    ],
  },
  {
    title: "Discovery",
    items: [
      { label: "Trending", href: "/admin/trending" as Route },
      { label: "Homepage", href: "/admin/homepage" as Route },
    ],
  },
  {
    title: "Monetization",
    items: [
      { label: "Ad Units", href: "/admin/ads/units" as Route, minRole: "EDITOR" },
      { label: "Ad Placements", href: "/admin/ads/placements" as Route, minRole: "EDITOR" },
    ],
  },
  {
    title: "Audience",
    items: [
      { label: "Newsletter", href: "/admin/subscribers" as Route, minRole: "EDITOR" },
    ],
  },
  {
    title: "Site",
    items: [
      { label: "Site Settings", href: "/admin/settings/site" as Route, minRole: "ADMIN" },
      { label: "SEO Settings", href: "/admin/settings/seo" as Route, minRole: "ADMIN" },
      { label: "Redirects", href: "/admin/redirects" as Route, minRole: "ADMIN" },
      { label: "Users", href: "/admin/users" as Route, minRole: "ADMIN" },
    ],
  },
  {
    title: "Account",
    items: [{ label: "My Account", href: "/admin/account" as Route }],
  },
];
