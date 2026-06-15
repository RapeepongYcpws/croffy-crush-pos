import {
  LayoutDashboard,
  ShoppingCart,
  ChefHat,
  UtensilsCrossed,
  Gift,
  BarChart3,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// เมนูหลักของระบบ — เพิ่ม feature ใหม่ได้โดยเพิ่มรายการที่นี่
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/order", label: "สั่งออเดอร์", icon: ShoppingCart },
  { href: "/kitchen", label: "ครัว", icon: ChefHat },
  { href: "/menu", label: "จัดการเมนู", icon: UtensilsCrossed },
  { href: "/rewards", label: "จัดการรางวัล", icon: Gift },
  { href: "/points", label: "เช็คคะแนน", icon: Sparkles },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
  { href: "/orders/search", label: "ค้นหาออเดอร์", icon: Search },
];
