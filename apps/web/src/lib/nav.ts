import { ArrowLeftRight, Bell, Briefcase, Coins, Download, FileBarChart2, Globe2, Home, Landmark, LineChart, PieChart, ReceiptText, Send, Settings, Shield, TrendingUp, UserRound, MoreHorizontal } from "lucide-react";

// Shared by the desktop sidebar and the "More" page. Plain data, safe to import from Server Components.
export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/exchange", label: "Currency Exchange", icon: Coins },
  { href: "/invest", label: "Investments", icon: TrendingUp },
  { href: "/history", label: "Transactions", icon: ReceiptText },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
