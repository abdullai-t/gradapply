/**
 * Single source of truth for sidebar / mobile-nav / topbar metadata.
 * Material Symbols icon names; route paths preserved from v1.
 */
export type NavRoute =
  | "dashboard"
  | "timeline"
  | "schools"
  | "emails"
  | "assistant"
  | "documents"
  | "profile"
  | "support"
  | "settings"
  | "admin";

export interface NavItem {
  key: NavRoute;
  href: string;
  label: string;
  icon: string;
  /** Topbar headline shown when this route is active. */
  title: string;
  /** Topbar search placeholder. */
  searchPlaceholder: string;
  /** Whether to render the floating action button on this page. */
  showFab: boolean;
  /** Override icon for the FAB (default `smart_toy`). */
  fabIcon?: string;
  /** Hide nav item entirely when plan === FREE. */
  freeHidden?: boolean;
  /** Hide nav item unless feature flag is enabled. */
  flag?: "settingsEnabled" | "supportTabEnabled";
  /** Hide nav item unless user is ADMIN/SUPERADMIN. */
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    title: "Dashboard",
    searchPlaceholder: "Search across everything...",
    showFab: true,
  },
  {
    key: "timeline",
    href: "/timeline",
    label: "Timeline",
    icon: "timeline",
    title: "Timeline & Deadlines",
    searchPlaceholder: "Search deadlines...",
    showFab: true,
  },
  {
    key: "schools",
    href: "/schools",
    label: "Schools",
    icon: "school",
    title: "Schools",
    searchPlaceholder: "Search schools...",
    showFab: false,
  },
  {
    key: "emails",
    href: "/emails",
    label: "Professor emails",
    icon: "mail",
    title: "Outreach",
    searchPlaceholder: "Search threads...",
    showFab: true,
  },
  {
    key: "assistant",
    href: "/assistant",
    label: "AI assistant",
    icon: "smart_toy",
    title: "AI Assistant",
    searchPlaceholder: "Search conversations...",
    showFab: false,
    freeHidden: true,
  },
  {
    key: "documents",
    href: "/documents",
    label: "Documents",
    icon: "description",
    title: "Documents Library",
    searchPlaceholder: "Search documents...",
    showFab: true,
    fabIcon: "cloud_upload",
    freeHidden: true,
  },
  {
    key: "profile",
    href: "/profile",
    label: "Profile",
    icon: "account_circle",
    title: "Profile",
    searchPlaceholder: "Search resources...",
    showFab: false,
  },
  {
    key: "support",
    href: "/support",
    label: "Support",
    icon: "support_agent",
    title: "Support",
    searchPlaceholder: "Search help articles...",
    showFab: false,
    flag: "supportTabEnabled",
  },
  {
    key: "settings",
    href: "/settings",
    label: "Settings",
    icon: "settings",
    title: "Settings",
    searchPlaceholder: "Search settings...",
    showFab: false,
    flag: "settingsEnabled",
  },
  {
    key: "admin",
    href: "/admin",
    label: "Admin",
    icon: "shield",
    title: "Admin",
    searchPlaceholder: "Search admin...",
    showFab: false,
    adminOnly: true,
  },
];

const FOOTER_KEYS = new Set<NavRoute>(["profile", "settings"]);

export function partitionNav(items: NavItem[]) {
  const main = items.filter((i) => !FOOTER_KEYS.has(i.key));
  const footer = items.filter((i) => FOOTER_KEYS.has(i.key));
  return { main, footer };
}

export function findActiveItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
}
