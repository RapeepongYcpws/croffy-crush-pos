"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Cookie, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ถ้า login อยู่แล้วให้เด้งไป dashboard
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  // const API_BASE =
  // process.env.NEXT_PUBLIC_API_BASE_URL;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-brand-100 to-brand-300">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-brand-500 flex items-center justify-center text-white mb-3">
            <Cookie size={28} />
          </div>
          <h1 className="text-2xl font-bold text-brand-700">croffy-crush</h1>
          <p className="text-sm text-gray-500">เข้าสู่ระบบ POS</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            {/* <div>{API_BASE}</div> */}
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-brand-600 text-white py-2.5 font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            เข้าสู่ระบบ
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          ค่าเริ่มต้น: admin / admin123
        </p>
      </div>
    </div>
  );
}
