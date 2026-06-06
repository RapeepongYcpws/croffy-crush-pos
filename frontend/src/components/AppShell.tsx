"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, Cookie } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { useAuth } from "@/lib/auth";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-brand-600 text-white shadow-md">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            aria-label="สลับเมนู"
            onClick={() => setOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-brand-500/60 transition-colors"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Cookie size={22} className="text-brand-100" />
            <span>croffy-crush</span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            {user && (
              <span className="hidden sm:inline text-sm text-brand-100">
                {user.full_name || user.username} · {user.role}
              </span>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-brand-700/60 hover:bg-brand-700 transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </div>

        {/* Collapsible nav row */}
        {open && (
          <nav className="border-t border-brand-500/40 bg-brand-600">
            <ul className="flex gap-1 px-2 py-2 overflow-x-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                        active
                          ? "bg-white text-brand-700 font-semibold"
                          : "text-brand-50 hover:bg-brand-500/60"
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
