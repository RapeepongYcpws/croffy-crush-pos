"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import { apiFetch, baht, type MenuItem, type Addon, type OrderDetail } from "@/lib/api";
import Modal from "@/components/Modal";

type CartLine = {
  key: string;
  menu: MenuItem;
  quantity: number;
  addons: Addon[];
  note: string;
};

const MENU_CACHE_KEY = "croffy_menu_cache_v1";
const ADDONS_CACHE_KEY = "croffy_addons_cache_v1";

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — ignore */
  }
}

export default function OrderPage() {
  const router = useRouter();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // add-on picker modal
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [pickAddons, setPickAddons] = useState<number[]>([]);
  const [pickNote, setPickNote] = useState("");

  // confirm modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Show cached data immediately (instant render), then revalidate in background.
    const cachedMenu = readCache<MenuItem[]>(MENU_CACHE_KEY);
    if (cachedMenu) setMenu(cachedMenu);
    const cachedAddons = readCache<Addon[]>(ADDONS_CACHE_KEY);
    if (cachedAddons) setAddons(cachedAddons);

    apiFetch<MenuItem[]>("/menu-items?active=1")
      .then((data) => {
        setMenu(data);
        writeCache(MENU_CACHE_KEY, data);
      })
      .catch((e) => {
        if (!cachedMenu) setError(e.message);
      });
    apiFetch<Addon[]>("/addons?active=1")
      .then((data) => {
        setAddons(data);
        writeCache(ADDONS_CACHE_KEY, data);
      })
      .catch(() => {});
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          menu
            .map((m) => m.category?.trim())
            .filter((c): c is string => !!c)
        )
      ).sort((a, b) => a.localeCompare(b, "th")),
    [menu]
  );

  const filteredMenu = useMemo(
    () =>
      activeCategory === "all"
        ? menu
        : menu.filter((m) => (m.category?.trim() || "") === activeCategory),
    [menu, activeCategory]
  );

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, l) => sum + (l.menu.price + l.addons.reduce((s, a) => s + a.price, 0)) * l.quantity,
        0
      ),
    [cart]
  );

  const openPicker = (m: MenuItem) => {
    setPicking(m);
    setPickAddons([]);
    setPickNote("");
  };

  const addToCart = () => {
    if (!picking) return;
    const chosen = addons.filter((a) => pickAddons.includes(a.id));
    setCart((c) => [
      ...c,
      {
        key: `${picking.id}-${Date.now()}`,
        menu: picking,
        quantity: 1,
        addons: chosen,
        note: pickNote.trim(),
      },
    ]);
    setPicking(null);
  };

  const changeQty = (key: string, delta: number) =>
    setCart((c) =>
      c.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, l.quantity + delta) } : l))
    );

  const removeLine = (key: string) => setCart((c) => c.filter((l) => l.key !== key));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        order_type: orderType,
        discount: 0,
        items: cart.map((l) => ({
          menu_item_id: l.menu.id,
          quantity: l.quantity,
          note: l.note || null,
          addon_ids: l.addons.map((a) => a.id),
        })),
      };
      const order = await apiFetch<OrderDetail>("/orders", { method: "POST", body });
      router.push(`/pay/${order.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Menu list */}
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-2xl font-bold text-gray-800">สั่งออเดอร์</h1>
        {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                activeCategory === "all" ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              ทั้งหมด
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                  activeCategory === c ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredMenu.map((m) => (
            <button
              key={m.id}
              onClick={() => openPicker(m)}
              className="bg-white rounded-xl shadow-sm overflow-hidden text-left hover:ring-2 hover:ring-brand-400 transition"
            >
              {m.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image_url} alt={m.name} loading="lazy" className="h-28 w-full object-cover" />
              ) : (
                <div className="h-28 w-full bg-brand-100 flex items-center justify-center text-brand-400 text-sm">
                  ไม่มีรูป
                </div>
              )}
              <div className="p-3">
                <p className="font-medium text-gray-800 text-sm">{m.name}</p>
                <p className="text-brand-700 font-bold text-sm">{baht(m.price)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <div className="bg-white rounded-xl shadow-sm p-4 h-fit lg:sticky lg:top-20">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
          <ShoppingCart size={18} /> ตะกร้า
        </h2>

        <div className="flex gap-2 mb-4">
          {(["dine_in", "takeaway"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                orderType === t ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600"
              }`}
            >
              {t === "dine_in" ? "ทานที่ร้าน" : "กลับบ้าน"}
            </button>
          ))}
        </div>

        {cart.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีรายการ</p>}

        <ul className="space-y-3">
          {cart.map((l) => {
            const lineUnit = l.menu.price + l.addons.reduce((s, a) => s + a.price, 0);
            return (
              <li key={l.key} className="border-b pb-3">
                <div className="flex justify-between">
                  <span className="font-medium text-sm">{l.menu.name}</span>
                  <button onClick={() => removeLine(l.key)} className="text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
                {l.addons.length > 0 && (
                  <p className="text-xs text-gray-500">+ {l.addons.map((a) => a.name).join(", ")}</p>
                )}
                {l.note && <p className="text-xs text-gray-400">หมายเหตุ: {l.note}</p>}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => changeQty(l.key, -1)} className="p-1 rounded bg-gray-100">
                      <Minus size={14} />
                    </button>
                    <span className="text-sm w-6 text-center">{l.quantity}</span>
                    <button onClick={() => changeQty(l.key, 1)} className="p-1 rounded bg-gray-100">
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-sm font-semibold">{baht(lineUnit * l.quantity)}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex justify-between font-bold text-lg mt-4">
          <span>รวม</span>
          <span className="text-brand-700">{baht(total)}</span>
        </div>

        <button
          disabled={cart.length === 0}
          onClick={() => setConfirmOpen(true)}
          className="w-full mt-4 bg-brand-600 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          ยืนยันออเดอร์
        </button>
      </div>

      {/* Add-on picker */}
      <Modal open={!!picking} title={picking?.name ?? ""} onClose={() => setPicking(null)}>
        <p className="text-sm text-gray-500 mb-3">เลือก topping เพิ่มเติม</p>
        <div className="space-y-2">
          {addons.map((a) => (
            <label key={a.id} className="flex items-center justify-between p-2 rounded-lg border cursor-pointer">
              <span className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={pickAddons.includes(a.id)}
                  onChange={(e) =>
                    setPickAddons((p) => (e.target.checked ? [...p, a.id] : p.filter((x) => x !== a.id)))
                  }
                />
                {a.name}
              </span>
              <span className="text-sm text-gray-500">+{baht(a.price)}</span>
            </label>
          ))}
          {addons.length === 0 && <p className="text-sm text-gray-400">ยังไม่มี topping</p>}
        </div>
        <input
          value={pickNote}
          onChange={(e) => setPickNote(e.target.value)}
          placeholder="หมายเหตุ (ถ้ามี)"
          className="input mt-3"
        />
        <button onClick={addToCart} className="w-full mt-4 bg-brand-600 text-white py-2.5 rounded-lg font-semibold">
          เพิ่มลงตะกร้า
        </button>
      </Modal>

      {/* Confirm */}
      <Modal open={confirmOpen} title="ยืนยันออเดอร์" onClose={() => setConfirmOpen(false)}>
        <p className="text-sm text-gray-600 mb-2">
          ประเภท: <b>{orderType === "dine_in" ? "ทานที่ร้าน" : "กลับบ้าน"}</b>
        </p>
        <ul className="text-sm space-y-1 mb-3 max-h-48 overflow-y-auto">
          {cart.map((l) => (
            <li key={l.key} className="flex justify-between">
              <span>
                {l.menu.name} x{l.quantity}
                {l.addons.length > 0 && (
                  <span className="text-gray-400"> ({l.addons.map((a) => a.name).join(", ")})</span>
                )}
              </span>
              <span>{baht((l.menu.price + l.addons.reduce((s, a) => s + a.price, 0)) * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-bold mb-4">
          <span>รวม</span>
          <span>{baht(total)}</span>
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-60"
        >
          {submitting ? "กำลังส่ง..." : "ยืนยันและไปหน้าชำระเงิน"}
        </button>
      </Modal>
    </div>
  );
}
