export const MAIN_NAV = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/marketplace", label: "All Products", icon: "store" },
  { href: "/category/weapon-skins", label: "Weapons", icon: "crosshair" },
  { href: "/category/outfits", label: "Outfits", icon: "shirt" },
  { href: "/category/crates", label: "Crates", icon: "box" },
  { href: "/category/bundles", label: "Bundles", icon: "gift" },
  { href: "/uc", label: "UC Top-Up", icon: "coins" },
  { href: "/contact", label: "Contact", icon: "mail" },
] as const;

/** Storefront categories (slugs match the Category table). */
export const CATEGORY_NAV = [
  { slug: "weapon-skins", label: "Weapon Skins", icon: "crosshair" },
  { slug: "outfits", label: "Outfits", icon: "shirt" },
  { slug: "helmets", label: "Helmets", icon: "hard-hat" },
  { slug: "backpacks", label: "Backpacks", icon: "backpack" },
  { slug: "vehicles", label: "Vehicle Skins", icon: "car" },
  { slug: "crates", label: "Crates", icon: "box" },
  { slug: "bundles", label: "Bundles", icon: "gift" },
] as const;

export const ACCOUNT_NAV = [
  { href: "/orders", label: "My Orders", icon: "receipt" },
  { href: "/wishlist", label: "Wishlist", icon: "heart" },
  { href: "/wallet", label: "Wallet", icon: "wallet" },
  { href: "/account", label: "Profile", icon: "user" },
  { href: "/account/sales", label: "My Sales", icon: "chart" },
  { href: "/sell/listings", label: "My Listings", icon: "list" },
  { href: "/sell", label: "Sell on ZYNOFLIX", icon: "tag" },
  { href: "/account/notifications", label: "Notifications", icon: "bell" },
  { href: "/account/settings", label: "Settings", icon: "settings" },
] as const;
