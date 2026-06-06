import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "croffy-crush POS",
  description: "ระบบ POS ร้านขนมครอฟเฟิล croffy-crush",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
