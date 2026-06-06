import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";

// ทุกหน้าในกลุ่มนี้ต้อง login (ถูก guard) และมี layout เมนูบน
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
