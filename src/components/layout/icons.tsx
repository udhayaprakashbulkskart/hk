import {
  Backpack, Bell, Box, Car, ChartNoAxesColumn, Coins, Crosshair, Gift, HardHat, Heart, Home, LifeBuoy, List, Mail, Package, Receipt,
  Settings, Shield, Shirt, Sparkles, Store, Tag, User, Wallet,
} from "lucide-react";

const MAP = {
  home: Home, store: Store, crosshair: Crosshair, tag: Tag, coins: Coins, life: LifeBuoy, receipt: Receipt, wallet: Wallet,
  user: User, heart: Heart, chart: ChartNoAxesColumn, list: List, bell: Bell, settings: Settings, shield: Shield,
  shirt: Shirt, car: Car, "hard-hat": HardHat, backpack: Backpack, box: Box, gift: Gift, sparkles: Sparkles, package: Package, mail: Mail,
};
export type IconName = keyof typeof MAP;
export function NavIcon({ name, className = "size-4" }: { name: string; className?: string }) {
  const I = MAP[name as IconName] ?? Box;
  return <I className={className} aria-hidden />;
}
