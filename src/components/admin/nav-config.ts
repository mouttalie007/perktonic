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
    items: [{ label: "Dashboard", href: "/adminiyad" as Route }],
  },
  {
    title: "Content",
    items: [
      { label: "Articles", href: "/adminiyad/articles" as Route },
      { label: "Categories", href: "/adminiyad/categories" as Route },
      { label: "Tags", href: "/adminiyad/tags" as Route },
      { label: "Authors", href: "/adminiyad/authors" as Route },
      { label: "Pages", href: "/adminiyad/pages" as Route },
      { label: "Media Library", href: "/adminiyad/media" as Route },
    ],
  },
  {
    title: "Discovery",
    items: [
      { label: "Trending", href: "/adminiyad/trending" as Route },
      { label: "Homepage", href: "/adminiyad/homepage" as Route },
    ],
  },
  {
    title: "Monetization",
    items: [
      { label: "Ad Units", href: "/adminiyad/ads/units" as Route, minRole: "EDITOR" },
      { label: "Ad Placements", href: "/adminiyad/ads/placements" as Route, minRole: "EDITOR" },
    ],
  },
  {
    title: "Audience",
    items: [
      { label: "Newsletter", href: "/adminiyad/subscribers" as Route, minRole: "EDITOR" },
      { label: "Contact Messages", href: "/adminiyad/contact-messages" as Route, minRole: "EDITOR" },
      { label: "Comments", href: "/adminiyad/comments" as Route, minRole: "EDITOR" },
    ],
  },
  {
    title: "Site",
    items: [
      { label: "Site Settings", href: "/adminiyad/settings/site" as Route, minRole: "ADMIN" },
      { label: "SEO Settings", href: "/adminiyad/settings/seo" as Route, minRole: "ADMIN" },
      { label: "Demo Engagement", href: "/adminiyad/settings/demo-engagement" as Route, minRole: "ADMIN" },
      { label: "Redirects", href: "/adminiyad/redirects" as Route, minRole: "ADMIN" },
      { label: "Users", href: "/adminiyad/users" as Route, minRole: "ADMIN" },
    ],
  },
  {
    title: "Account",
    items: [{ label: "My Account", href: "/adminiyad/account" as Route }],
  },
];
