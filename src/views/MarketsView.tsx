import React, { useState, useEffect } from 'react';
import {
  Store,
  Tag,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  CheckSquare,
  Square,
  AlertCircle,
} from 'lucide-react';
import { Market, Category } from '../types';
import {
  getMarkets,
  getCategories,
  saveMarket,
  deleteMarket,
  saveCategory,
  deleteCategory,
} from '../services/db';
import { Dialog } from '../components/Dialog';

interface MarketsViewProps {
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const MarketsView: React.FC<MarketsViewProps> = ({ showToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<'markets' | 'categories'>('markets');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Market Form
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [marketFormData, setMarketFormData] = useState({
    name: '',
    description: '',
    categoryIds: [] as string[],
  });
  const [isSavingMarket, setIsSavingMarket] = useState(false);
  const [marketToDelete, setMarketToDelete] = useState<Market | null>(null);
  const [isDeletingMarket, setIsDeletingMarket] = useState(false);

  // Category Form
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catNameInput, setCatNameInput] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);
  const [isDeletingCat, setIsDeletingCat] = useState(false);

  const reloadData = () => {
    setMarkets(getMarkets());
    setCategories(getCategories());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // --- MARKET ACTIONS ---
  const handleOpenAddMarket = () => {
    setEditingMarket(null);
    setMarketFormData({
      name: '',
      description: '',
      categoryIds: categories.map((c) => c.id), // default all checked
    });
    setIsMarketModalOpen(true);
  };

  const handleOpenEditMarket = (market: Market) => {
    setEditingMarket(market);
    setMarketFormData({
      name: market.name,
      description: market.description || '',
      categoryIds: market.categoryIds || [],
    });
    setIsMarketModalOpen(true);
  };

  const handleToggleMarketCategory = (catId: string) => {
    setMarketFormData((prev) => {
      const exists = prev.categoryIds.includes(catId);
      return {
        ...prev,
        categoryIds: exists
          ? prev.categoryIds.filter((id) => id !== catId)
          : [...prev.categoryIds, catId],
      };
    });
  };

  const handleSaveMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingMarket) return;

    if (!marketFormData.name.trim()) {
      showToast('error', 'กรุณาระบุชื่อตลาด');
      return;
    }

    try {
      setIsSavingMarket(true);
      await saveMarket({
        id: editingMarket?.id,
        name: marketFormData.name.trim(),
        description: marketFormData.description.trim(),
        categoryIds: marketFormData.categoryIds,
      });

      showToast('success', editingMarket ? '✓ บันทึกตลาดสำเร็จ' : '✓ เพิ่มตลาดสำเร็จ');
      setIsMarketModalOpen(false);
      reloadData();
    } catch (err: any) {
      showToast('error', err?.message || 'ไม่สามารถบันทึกตลาดได้');
    } finally {
      setIsSavingMarket(false);
    }
  };

  const handleConfirmDeleteMarket = async () => {
    if (!marketToDelete || isDeletingMarket) return;
    try {
      setIsDeletingMarket(true);
      await deleteMarket(marketToDelete.id);
      showToast('success', `✓ ลบตลาด "${marketToDelete.name}" สำเร็จ`);
      setMarketToDelete(null);
      reloadData();
    } catch (err: any) {
      showToast('error', err?.message || 'ไม่สามารถลบตลาดได้');
    } finally {
      setIsDeletingMarket(false);
    }
  };

  // --- CATEGORY ACTIONS ---
  const handleOpenAddCategory = () => {
    setEditingCat(null);
    setCatNameInput('');
    setIsCatModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCat(cat);
    setCatNameInput(cat.name);
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingCat) return;

    if (!catNameInput.trim()) {
      showToast('error', 'กรุณาระบุชื่อหมวดหมู่');
      return;
    }

    try {
      setIsSavingCat(true);
      await saveCategory({
        id: editingCat?.id,
        name: catNameInput.trim(),
      });

      showToast('success', editingCat ? '✓ บันทึกหมวดหมู่สำเร็จ' : '✓ เพิ่มหมวดหมู่สำเร็จ');
      setIsCatModalOpen(false);
      reloadData();
    } catch (err: any) {
      showToast('error', err?.message || 'ไม่สามารถบันทึกหมวดหมู่ได้');
    } finally {
      setIsSavingCat(false);
    }
  };

  const handleConfirmDeleteCat = async () => {
    if (!catToDelete || isDeletingCat) return;
    try {
      setIsDeletingCat(true);
      await deleteCategory(catToDelete.id);
      showToast('success', `✓ ลบหมวดหมู่ "${catToDelete.name}" สำเร็จ`);
      setCatToDelete(null);
      reloadData();
    } catch (err: any) {
      showToast('error', err?.message || 'ไม่สามารถลบหมวดหมู่ได้');
    } finally {
      setIsDeletingCat(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('markets')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeSubTab === 'markets'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>ตลาด ({markets.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('categories')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeSubTab === 'categories'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>หมวดหมู่ ({categories.length})</span>
          </button>
        </div>

        {activeSubTab === 'markets' ? (
          <button
            type="button"
            onClick={handleOpenAddMarket}
            className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-98 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มตลาด</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenAddCategory}
            className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-98 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มหมวดหมู่</span>
          </button>
        )}
      </div>

      {/* --- MARKETS VIEW --- */}
      {activeSubTab === 'markets' && (
        <div>
          {markets.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
              <Store className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
                ยังไม่มีข้อมูลตลาด
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                เริ่มต้นระบบไม่มีตลาดตัวอย่าง คลิกปุ่ม "เพิ่มตลาด" ด้านบนเพื่อเริ่มต้นสร้างตลาด
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {markets.map((market) => {
                const assignedCats = categories.filter((c) =>
                  (market.categoryIds || []).includes(c.id)
                );

                return (
                  <div
                    key={market.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                            <Store className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                              {market.name}
                            </h3>
                            {market.description && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                {market.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditMarket(market)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="แก้ไขตลาด"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setMarketToDelete(market)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            title="ลบตลาด"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Display assigned categories */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-xs font-semibold text-slate-500 mb-2">
                          หมวดหมู่ที่แสดงในตลาดนี้ ({assignedCats.length}):
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {assignedCats.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">
                              แสดงทุกหมวดหมู่ (หรือยังไม่ได้กำหนด)
                            </span>
                          ) : (
                            assignedCats.map((cat) => (
                              <span
                                key={cat.id}
                                className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300"
                              >
                                {cat.name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- CATEGORIES VIEW --- */}
      {activeSubTab === 'categories' && (
        <div>
          {categories.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
              <Tag className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
                ยังไม่มีข้อมูลหมวดหมู่
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                เริ่มต้นระบบไม่มีหมวดหมู่ตัวอย่าง คลิก "เพิ่มหมวดหมู่" ด้านบน (หมวดหมู่สามารถผูกกับหลายตลาดได้ เช่น ผัก อยู่ได้ทั้งตลาดเช้าและตลาดค่ำ)
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              {categories.map((cat) => {
                // Find markets where this category is used
                const usedInMarkets = markets.filter(
                  (m) => (m.categoryIds || []).includes(cat.id)
                );

                return (
                  <div
                    key={cat.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {cat.name}
                        </h4>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        ใช้ใน {usedInMarkets.length} ตลาด
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditCategory(cat)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCatToDelete(cat)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Market Modal */}
      {isMarketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingMarket ? 'แก้ไขตลาด' : 'เพิ่มตลาดใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setIsMarketModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMarket} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อตลาด <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={marketFormData.name}
                  onChange={(e) =>
                    setMarketFormData({ ...marketFormData, name: e.target.value })
                  }
                  placeholder="เช่น ตลาดเช้า, ตลาดค่ำ, สาขา 1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  รายละเอียด / ที่ตั้ง (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={marketFormData.description}
                  onChange={(e) =>
                    setMarketFormData({ ...marketFormData, description: e.target.value })
                  }
                  placeholder="เช่น ลานจอดหน้าห้าง หรือเวลาเปิดปิด"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Bind Categories to Market */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  หมวดหมู่ที่แสดงในตลาดนี้
                </label>
                {categories.length === 0 ? (
                  <p className="text-xs text-amber-600">
                    * ยังไม่มีหมวดหมู่ สามารถเพิ่มหมวดหมู่ได้ที่แท็บ "หมวดหมู่"
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    {categories.map((cat) => {
                      const isChecked = marketFormData.categoryIds.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleToggleMarketCategory(cat.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-left transition-all ${
                            isChecked
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsMarketModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingMarket}
                  className="py-2.5 px-5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-98 transition-all disabled:opacity-50"
                >
                  {isSavingMarket ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingCat ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อหมวดหมู่ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  placeholder="เช่น ผัก, เนื้อสัตว์, ผลไม้"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingCat}
                  className="py-2.5 px-5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-98 transition-all disabled:opacity-50"
                >
                  {isSavingCat ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dialogs */}
      <Dialog
        isOpen={!!marketToDelete}
        title="ลบตลาด?"
        targetName={marketToDelete?.name}
        description="การลบตลาดจะไม่ลบสินค้าหรือหมวดหมู่ แต่จะลบการผูกตลาดนี้"
        confirmLabel="ลบตลาด"
        cancelLabel="ยกเลิก"
        isDestructive={true}
        isLoading={isDeletingMarket}
        onConfirm={handleConfirmDeleteMarket}
        onCancel={() => setMarketToDelete(null)}
      />

      <Dialog
        isOpen={!!catToDelete}
        title="ลบหมวดหมู่?"
        targetName={catToDelete?.name}
        description="การลบข้อมูลนี้ไม่สามารถย้อนกลับได้"
        confirmLabel="ลบหมวดหมู่"
        cancelLabel="ยกเลิก"
        isDestructive={true}
        isLoading={isDeletingCat}
        onConfirm={handleConfirmDeleteCat}
        onCancel={() => setCatToDelete(null)}
      />
    </div>
  );
};
