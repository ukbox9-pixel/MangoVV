import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  User as UserIcon,
  X,
  Lock,
  Store,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { User, Market } from '../types';
import { getUsers, getMarkets, saveUser, deleteUser } from '../services/db';
import { Dialog } from '../components/Dialog';

interface UsersViewProps {
  currentUser: User;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({ currentUser, showToast }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    pin: '',
    role: 0 as 0 | 1,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    marketIds: [] as string[],
  });

  // Multi-click submission prevention lock
  const [isSaving, setIsSaving] = useState(false);
  const saveLockRef = useRef(false);

  // Delete State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const reloadData = () => {
    setUsers(getUsers());
    setMarkets(getMarkets());
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      pin: '',
      role: 0,
      status: 'ACTIVE',
      marketIds: markets.map((m) => m.id), // default access all markets
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      pin: user.pin,
      role: user.role,
      status: user.status,
      marketIds: user.marketIds || [],
    });
    setIsModalOpen(true);
  };

  const handleToggleMarket = (marketId: string) => {
    setFormData((prev) => {
      const exists = prev.marketIds.includes(marketId);
      return {
        ...prev,
        marketIds: exists
          ? prev.marketIds.filter((id) => id !== marketId)
          : [...prev.marketIds, marketId],
      };
    });
  };

  // Save User with anti-multi-click lock & duplicate PIN detection
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent multi-click spamming ("กดบันทึก 4-5 ครั้งต้องไม่สร้าง 4-5 บัญชี")
    if (saveLockRef.current || isSaving) return;

    if (!formData.name.trim()) {
      showToast('error', 'กรุณาระบุชื่อผู้ใช้งาน');
      return;
    }

    if (!formData.pin.trim() || formData.pin.length !== 4 || !/^\d{4}$/.test(formData.pin)) {
      showToast('error', 'รหัส PIN ต้องเป็นตัวเลข 4 หลัก เช่น 1234');
      return;
    }

    try {
      saveLockRef.current = true;
      setIsSaving(true);

      await saveUser({
        id: editingUser?.id,
        name: formData.name.trim(),
        pin: formData.pin.trim(),
        role: formData.role,
        status: formData.status,
        marketIds: formData.marketIds,
      });

      showToast('success', editingUser ? '✓ บันทึกข้อมูลสำเร็จ' : '✓ เพิ่มผู้ใช้งานสำเร็จ');
      setIsModalOpen(false);
      reloadData();
    } catch (err: any) {
      // Clear specific error message (e.g. "ไม่สามารถบันทึกได้ - PIN นี้ถูกใช้งานแล้ว")
      showToast('error', err?.message || 'ไม่สามารถบันทึกผู้ใช้ได้');
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete || isDeleting) return;

    try {
      setIsDeleting(true);
      await deleteUser(userToDelete.id);
      showToast('success', `✓ ลบผู้ใช้งาน "${userToDelete.name}" สำเร็จ`);
      setUserToDelete(null);
      reloadData();
    } catch (err: any) {
      showToast('error', err?.message || 'ไม่สามารถลบผู้ใช้งานได้');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>จัดการผู้ใช้งาน (Users & Roles)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            เพิ่มผู้ใช้งาน กำหนดสิทธิ์ Admin/ผู้ใช้ทั่วไป กำหนดรหัส PIN และสิทธิ์เข้าถึงตลาด
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-xs transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มผู้ใช้งาน</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 text-xs">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">ชื่อผู้ใช้งาน</th>
                <th className="py-3 px-4">รหัส PIN</th>
                <th className="py-3 px-4">สิทธิ์ (Role)</th>
                <th className="py-3 px-4">สถานะ</th>
                <th className="py-3 px-4">ตลาดที่เข้าถึงได้</th>
                <th className="py-3 px-4 text-center w-28">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u, idx) => {
                const isAdmin = u.role === 1;
                const isDefaultAdmin = u.pin === '0000' && isAdmin;

                const assignedMarketNames = markets
                  .filter((m) => (u.marketIds || []).includes(m.id))
                  .map((m) => m.name);

                return (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-xs">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                          isAdmin ? 'bg-amber-600' : 'bg-emerald-600'
                        }`}
                      >
                        {u.name.charAt(0)}
                      </div>
                      <span>{u.name}</span>
                      {isDefaultAdmin && (
                        <span className="text-[10px] font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">
                          หลัก
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      •••• ({u.pin})
                    </td>

                    <td className="py-3 px-4">
                      {isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <ShieldCheck className="w-3 h-3" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <UserIcon className="w-3 h-3" />
                          ผู้ใช้งาน
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'ใช้งานปกติ' : 'ระงับการใช้งาน'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {isAdmin || !u.marketIds || u.marketIds.length === 0
                        ? 'เข้าถึงได้ทุกตลาด'
                        : assignedMarketNames.join(', ') || 'ไม่ได้กำหนด'}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {!isDefaultAdmin && (
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingUser ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อผู้ใช้งาน <span className="text-rose-500">*</span> (สามารถซ้ำได้)
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น สมชาย, มานี, ฝ่ายจัดซื้อ 1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  รหัส PIN 4 หลัก <span className="text-rose-500">*</span> (ห้ามซ้ำกับผู้ใช้อื่น)
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={formData.pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, pin: val });
                  }}
                  placeholder="เช่น 1234"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-widest text-base"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  ระบบจะตรวจสอบ PIN ซ้ำทันทีเพื่อความปลอดภัย
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    สิทธิ์ (Role)
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: Number(e.target.value) as 0 | 1 })
                    }
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={0}>0 - ผู้ใช้งานทั่วไป</option>
                    <option value={1}>1 - Admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    สถานะ
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as 'ACTIVE' | 'INACTIVE',
                      })
                    }
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ACTIVE">ACTIVE (ใช้งานได้)</option>
                    <option value="INACTIVE">INACTIVE (ระงับ)</option>
                  </select>
                </div>
              </div>

              {/* Accessible Markets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ตลาดที่อนุญาตให้สั่งซื้อ
                </label>
                {markets.length === 0 ? (
                  <p className="text-xs text-amber-600">
                    * ยังไม่มีตลาดในระบบ (สามารถไปเพิ่มได้ที่เมนู "ตลาด/หมวดหมู่")
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    {markets.map((m) => {
                      const isChecked = formData.marketIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleMarket(m.id)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {m.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="py-2.5 px-5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-98 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Dialog matching Requirement 13 */}
      <Dialog
        isOpen={!!userToDelete}
        title="ลบผู้ใช้งาน?"
        targetName={userToDelete?.name}
        description="การลบข้อมูลนี้ไม่สามารถย้อนกลับได้ ผู้ใช้จะไม่สามารถเข้าสู่ระบบด้วย PIN นี้ได้อีก"
        confirmLabel="ลบผู้ใช้งาน"
        cancelLabel="ยกเลิก"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
};
