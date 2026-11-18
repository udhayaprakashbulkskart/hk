import {
  Bell, ChartNoAxesColumn, Coins, Crosshair, Heart, Home, LifeBuoy, List, Receipt, Settings, Store, Tag, User, Wallet, Shield,
} from "lucide-react";

const MAP = {
  home: Home, store: Store, crosshair: Crosshair, tag: Tag, coins: Coins, life: LifeBuoy, receipt: Receipt, wallet: Wallet,
  user: User, heart: Heart, chart: ChartNoAxesColumn, list: List, bell: Bell, settings: Settings, shield: Shield,
};
export type IconName = keyof typeof MAP;
export function NavIcon({ name, className = "size-4" }: { name: IconName; className?: string }) {
  const I = MAP[name];
  return <I className={className} aria-hidden />;
}
