"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ArrowUpDown, GripVertical, ImagePlus } from "lucide-react";
import { apiFetch, baht, type MenuItem } from "@/lib/api";
import Modal from "@/components/Modal";

type FormState = {
  name: string;
  price: string;
  description: string;
  image_url: string;
  category: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  price: "",
  description: "",
  image_url: "",
  category: "",
  is_active: true,
};

type SortKey =
  | "manual"
  | "newest"
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc"
  | "status";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "manual", label: "ลำดับที่กำหนดเอง (ลากจัดเรียง)" },
  { value: "newest", label: "ใหม่ล่าสุด" },
  { value: "name_asc", label: "ชื่อ (ก-ฮ / A-Z)" },
  { value: "name_desc", label: "ชื่อ (ฮ-ก / Z-A)" },
  { value: "price_asc", label: "ราคา (น้อย → มาก)" },
  { value: "price_desc", label: "ราคา (มาก → น้อย)" },
  { value: "status", label: "สถานะ (เปิดขายก่อน)" },
];

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("manual");
  const [dragId, setDragId] = useState<number | null>(null);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((m) => m.category?.trim())
            .filter((c): c is string => !!c)
        )
      ).sort((a, b) => a.localeCompare(b, "th")),
    [items]
  );

  const sortedItems = useMemo(() => {
    const arr = [...items];
    switch (sortBy) {
      case "manual":
        return arr;
      case "name_asc":
        return arr.sort((a, b) => a.name.localeCompare(b.name, "th"));
      case "name_desc":
        return arr.sort((a, b) => b.name.localeCompare(a.name, "th"));
      case "price_asc":
        return arr.sort((a, b) => a.price - b.price);
      case "price_desc":
        return arr.sort((a, b) => b.price - a.price);
      case "status":
        return arr.sort((a, b) => Number(b.is_active) - Number(a.is_active));
      case "newest":
      default:
        return arr.sort((a, b) => b.id - a.id);
    }
  }, [items, sortBy]);

  const load = () => {
    apiFetch<MenuItem[]>("/menu-items")
      .then(setItems)
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const onDrop = (targetId: number) => {
    if (dragId === null || dragId === targetId) {
      setDragId(null);
      return;
    }
    const next = [...items];
    const from = next.findIndex((m) => m.id === dragId);
    const to = next.findIndex((m) => m.id === targetId);
    if (from === -1 || to === -1) {
      setDragId(null);
      return;
    }
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setDragId(null);
    apiFetch("/menu-items/reorder", {
      method: "PUT",
      body: { ordered_ids: next.map((m) => m.id) },
    }).catch((e) => {
      setError(e.message);
      load();
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (m: MenuItem) => {
    setEditing(m);
    setForm({
      name: m.name,
      price: String(m.price),
      description: m.description ?? "",
      image_url: m.image_url ?? "",
      category: m.category ?? "",
      is_active: m.is_active,
    });
    setModalOpen(true);
  };

  const onImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setError(null);
    try {
      const dataUrl = await compressImage(file, 2 * 1024 * 1024);
      setForm((f) => ({ ...f, image_url: dataUrl }));
    } catch {
      setError("ไม่สามารถประมวลผลรูปภาพได้");
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name: form.name,
      price: parseFloat(form.price) || 0,
      description: form.description || null,
      image_url: form.image_url || null,
      category: form.category.trim() || null,
      is_active: form.is_active,
    };
    try {
      if (editing) {
        await apiFetch(`/menu-items/${editing.id}`, { method: "PUT", body });
      } else {
        await apiFetch("/menu-items", { method: "POST", body });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: MenuItem) => {
    if (!confirm(`ลบเมนู "${m.name}"?`)) return;
    try {
      await apiFetch(`/menu-items/${m.id}`, { method: "DELETE" });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการเมนู</h1>
          <p className="text-sm text-gray-500">เพิ่ม แก้ไข ลบ เมนูสินค้า</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <ArrowUpDown size={16} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="text-sm bg-transparent outline-none text-gray-700"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700"
          >
            <Plus size={18} /> เพิ่มเมนู
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      {sortBy === "manual" && (
        <p className="text-sm text-gray-500">ลากการ์ดเพื่อจัดลำดับ — ลำดับจะถูกบันทึกอัตโนมัติ</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedItems.map((m) => (
          <div
            key={m.id}
            draggable={sortBy === "manual"}
            onDragStart={() => setDragId(m.id)}
            onDragOver={(e) => {
              if (sortBy === "manual") e.preventDefault();
            }}
            onDrop={() => sortBy === "manual" && onDrop(m.id)}
            className={`bg-white rounded-xl shadow-sm overflow-hidden relative ${
              sortBy === "manual" ? "cursor-move" : ""
            } ${dragId === m.id ? "opacity-50 ring-2 ring-brand-400" : ""}`}
          >
            {sortBy === "manual" && (
              <div className="absolute top-2 left-2 z-10 bg-white/80 rounded-md p-1 text-gray-400">
                <GripVertical size={16} />
              </div>
            )}
            {m.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.image_url} alt={m.name} className="h-36 w-full object-cover" />
            ) : (
              <div className="h-36 w-full bg-brand-100 flex items-center justify-center text-brand-400">
                ไม่มีรูป
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-800">{m.name}</h3>
                <span className="font-bold text-brand-700">{baht(m.price)}</span>
              </div>
              {m.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{m.description}</p>}
              <div className="flex items-center gap-2 mt-3">
                {m.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">{m.category}</span>
                )}
                {!m.is_active && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">ปิดขาย</span>
                )}
                <div className="ml-auto flex gap-1">
                  <button onClick={() => openEdit(m)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => remove(m)} className="p-2 rounded-lg hover:bg-red-50 text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} title={editing ? "แก้ไขเมนู" : "เพิ่มเมนู"} onClose={() => setModalOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <Field label="ชื่อเมนู">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="ราคา (บาท)">
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="หมวดหมู่">
            <input
              list="menu-categories"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="เช่น croffle, เครื่องดื่ม (เลือกหรือพิมพ์ใหม่)"
              className="input"
            />
            <datalist id="menu-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="รูปภาพ">
            {form.image_url ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image_url}
                  alt="preview"
                  className="h-32 w-full max-w-xs object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, image_url: "" })}
                  className="absolute top-1 right-1 bg-white/90 rounded-full p-1 text-red-600 hover:bg-white"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 h-32 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer text-gray-400 hover:border-brand-400 hover:text-brand-500">
                <ImagePlus size={22} />
                <span className="text-sm">คลิกเพื่ออัปโหลดรูป (ระบบจะย่อขนาดให้อัตโนมัติ)</span>
                <input type="file" accept="image/*" onChange={onImageChange} className="hidden" />
              </label>
            )}
          </Field>
          <Field label="คำอธิบาย">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="input"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            เปิดขาย
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-60"
          >
            บันทึก
          </button>
        </form>
      </Modal>
    </div>
  );
}

// compressImage downscales + re-encodes an image file to a JPEG data URL
// whose byte size stays under maxBytes. It progressively lowers quality, then
// dimensions, until the target is met.
async function compressImage(file: File, maxBytes: number): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  // Small files that are already under the limit are kept as-is.
  if (file.size <= maxBytes) return dataUrl;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("load failed"));
    el.src = dataUrl;
  });

  const byteSize = (url: string) => Math.ceil((url.split(",")[1]?.length ?? 0) * 0.75);

  let width = img.width;
  let height = img.height;
  let maxDim = Math.max(width, height);

  for (let attempt = 0; attempt < 12; attempt++) {
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Try decreasing quality at the current dimensions.
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const out = canvas.toDataURL("image/jpeg", quality);
      if (byteSize(out) <= maxBytes) return out;
    }

    // Still too big — shrink dimensions and retry.
    maxDim = Math.round(Math.max(width, height) * scale * 0.8);
    width = canvas.width;
    height = canvas.height;
  }

  throw new Error("could not compress under limit");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
