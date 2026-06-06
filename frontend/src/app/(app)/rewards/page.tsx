"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Gift } from "lucide-react";
import { apiFetch, type Reward } from "@/lib/api";
import Modal from "@/components/Modal";

type FormState = { name: string; points_cost: string; description: string; is_active: boolean };
const emptyForm: FormState = { name: "", points_cost: "", description: "", is_active: true };

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch<Reward[]>("/rewards").then(setRewards).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };
  const openEdit = (rw: Reward) => {
    setEditing(rw);
    setForm({
      name: rw.name,
      points_cost: String(rw.points_cost),
      description: rw.description ?? "",
      is_active: rw.is_active,
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      name: form.name,
      points_cost: parseInt(form.points_cost, 10) || 0,
      description: form.description || null,
      is_active: form.is_active,
    };
    try {
      if (editing) await apiFetch(`/rewards/${editing.id}`, { method: "PUT", body });
      else await apiFetch("/rewards", { method: "POST", body });
      setModalOpen(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rw: Reward) => {
    if (!confirm(`ลบรางวัล "${rw.name}"?`)) return;
    try {
      await apiFetch(`/rewards/${rw.id}`, { method: "DELETE" });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการรางวัล</h1>
          <p className="text-sm text-gray-500">เพิ่ม แก้ไข ลบ ของรางวัลสะสมคะแนน</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700">
          <Plus size={18} /> เพิ่มรางวัล
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {rewards.map((rw) => (
          <div key={rw.id} className="flex items-center gap-3 p-4">
            <div className="h-10 w-10 rounded-lg bg-brand-100 flex items-center justify-center text-brand-500">
              <Gift size={18} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">{rw.name}</p>
              <p className="text-sm text-gray-500">
                {rw.points_cost} คะแนน {!rw.is_active && "· ปิดใช้งาน"}
              </p>
            </div>
            <button onClick={() => openEdit(rw)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600">
              <Pencil size={16} />
            </button>
            <button onClick={() => remove(rw)} className="p-2 rounded-lg hover:bg-red-50 text-red-600">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {rewards.length === 0 && <p className="p-4 text-sm text-gray-400">ยังไม่มีรางวัล</p>}
      </div>

      <Modal open={modalOpen} title={editing ? "แก้ไขรางวัล" : "เพิ่มรางวัล"} onClose={() => setModalOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อรางวัล</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนคะแนน</label>
            <input
              required
              type="number"
              min="1"
              value={form.points_cost}
              onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            เปิดใช้งาน
          </label>
          <button type="submit" disabled={saving} className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-60">
            บันทึก
          </button>
        </form>
      </Modal>
    </div>
  );
}
