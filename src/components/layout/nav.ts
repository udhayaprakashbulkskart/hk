export const MAIN_NAV = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/skins", label: "Skins", icon: "store" },
  { href: "/guns", label: "Guns", icon: "crosshair" },
  { href: "/uc", label: "UC Top-Up", icon: "coins" },
  { href: "/sell", label: "Sell", icon: "tag" },
  { href: "/support", label: "Support", icon: "life" },
] as const;

export const ACCOUNT_NAV = [
  { href: "/orders", label: "My Orders", icon: "receipt" },
  { href: "/wallet", label: "Wallet", icon: "wallet" },
  { href: "/account", label: "Profile", icon: "user" },
  { href: "/account/saved", label: "Saved Items", icon: "heart" },
  { href: "/account/sales", label: "My Sales", icon: "chart" },
  { href: "/sell/listings", label: "My Listings", icon: "list" },
  { href: "/account/notifications", label: "Notifications", icon: "bell" },
  { href: "/account/settings", label: "Settings", icon: "settings" },
] as const;
