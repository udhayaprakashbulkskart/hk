import { ArrowLeftRight, Bell, Briefcase, Coins, Download, FileBarChart2, Globe2, Home, Landmark, LineChart, PieChart, ReceiptText, Send, Settings, Shield, TrendingUp, UserRound, MoreHorizontal } from "lucide-react";

// Shared by the desktop sidebar and the "More" page. Plain data, safe to import from Server Components.
export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/send", label: "Send Money", icon: Send },
  { href: "/receive", label: "Receive Money", icon: Download },
  { href: "/transfer", label: "Global Transfer", icon: Globe2 },
  { href: "/exchange", label: "Currency Exchange", icon: Coins },
  { href: "/invest", label: "Investments", icon: TrendingUp },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/history", label: "Transactions", icon: ReceiptText },
  { href: "/reports", label: "Statements", icon: FileBarChart2 },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
