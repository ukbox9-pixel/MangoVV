import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Package,
  Plus,
  Upload,
  Search,
  Edit2,
  Trash2,
  X,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Item, Category } from '../types';
import {
  getItems,
  getCategories,
  saveItem,
  deleteItem,
  importItemsFromExcel,
} from '../services/db';
import { Dialog } from '../components/Dialog';

interface ItemsViewProps {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const PRESET_UNITS = ['กิโลกรัม', 'ลูก', 'ชิ้น', 'ลิตร', 'อื่นๆ'];

export const ItemsView: React.FC<ItemsViewProps> = ({ showToast }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('ALL');

  // Form modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    stock: 0,
    unitPreset: 'กิโลกรัม',
    unitCustom: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Excel Import modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<
    Array<{ name: string; category?: string; stock?: number; unit?: string }>
  >([]);
  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadData = () => {
    setItems(getItems());
    setCategories(getCategories());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCatFilter !== 'ALL' && item.categoryId !== selectedCatFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCat = (item.categoryName || '').toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [items, selectedCatFilter, searchQuery]);

  // Open Add modal
  const handleOpenAdd = () => {
    const defaultCat = categories.length > 0 ? categories[0].id : '';
    setEditingItem(null);
    setFormData({
      name: '',
      categoryId: defaultCat,
      stock: 0,
      unitPreset: 'กิโลกรัม',
      unitCustom: '',
    });
    setIsFormOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    const isPreset = PRESET_UNITS.slice(0, 4).includes(item.unit);
    setFormData({
      name: item.name,
      categoryId: item.categoryId,
      stock: item.stock,
      unitPreset: isPreset ? item.unit : 'อื่นๆ',
      unitCustom: isPreset ? '' : item.unit,
    });
    setIsFormOpen(true);
  };

  // Save Item
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    const unit =
      formData.unitPreset === 'อื่นๆ' ? formData.unitCustom.trim() : formData.unitPreset;

    if (!formData.name.trim()) {
      showToast('error', 'กรุณาระบุชื่อสินค้า');
      return;
    }
    if (!formData.categoryId) {
      showToast('error', 'กรุณาเลือกหมวดหมู่');
      return;
    }
    if (!unit) {
      showToast('error', 'กรุณาระบุหน่วยนับ');
      return;
    }

    try {
      setIsSaving(true);
      await saveItem({
        id: editingItem?.id,
        name: formData.name.trim(),
        categoryId: formData.categoryId,
        stock: Number(formData.stock) || 0,
        unit,
      });

      showToast('success', editingItem ? '✓ บันทึกการแก้ไขสำเร็จ' : '✓ เพิ่มสินค้าสำเร็จ');
      setIsFormOpen(false);
      reloadData();
    } catch (err: any) {
      showToast('error', err?.message || 'ไม่สามารถบันทึกสินค้าได้');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Item
  const handleConfirmDelete = async () => {
    if (!itemToDelete || isDeleting) return;
    try {
      setIsDeleting(true);
      await deleteItem(itemToDelete.id);
      showToast('success', `✓ ลบสินค้า "${itemToDelete.name}" สำเร็จ`);
      setItemToDelete(null);
      reloadData();
    } catch (err: any) {
      showToast('error', err?.message || 'ไม่สามารถลบสินค้าได้');
    } finally {
      setIsDeleting(false);
    }
  };

  // Excel File Upload & Parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          showToast('error', 'ไม่พบข้อมูลในไฟล์ Excel');
          return;
        }

        // Flexible column mapping
        const parsedRows = rawJson.map((row) => {
          // Find name column
          const nameVal =
            row['ชื่อ'] || row['ชื่อสินค้า'] || row['name'] || row['Item Name'] || row['สินค้า'] || '';
          // Find category column (if missing or empty, will fallback safely)
          const catVal =
            row['หมวดหมู่'] || row['หมวด'] || row['category'] || row['Category'] || '';
          // Find stock
          const stockVal =
            row['stock'] || row['Stock'] || row['คงเหลือ'] || row['จำนวน'] || 0;
          // Find unit
          const unitVal =
            row['หน่วย'] || row['unit'] || row['Unit'] || 'ชิ้น';

          return {
            name: String(nameVal).trim(),
            category: String(catVal).trim(),
            stock: Number(stockVal) || 0,
            unit: String(unitVal).trim(),
          };
        }).filter((r) => r.name !== '');

        if (parsedRows.length === 0) {
          showToast('error', 'ไม่พบคอลัมน์ชื่อสินค้าในไฟล์');
          return;
        }

        setImportRows(parsedRows);
        setIsImportModalOpen(true);
      } catch (err: any) {
        showToast('error', 'เกิดข้อผิดพลาดในการอ่านไฟล์: ' + err?.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Confirm Excel Import
  const handleConfirmImport = async () => {
    if (importRows.length === 0 || isImporting) return;
    try {
      setIsImporting(true);
      const res = await importItemsFromExcel(importRows);
      showToast(
        'success',
        `✓ นำเข้าสำเร็จ: เพิ่มใหม่ ${res.added} รายการ, อัปเดต ${res.updated} รายการ${
          res.categoriesCreated > 0 ? ` (สร้างหมวดใหม่ ${res.categoriesCreated} หมวด)` : ''
        }`
      );
      setIsImportModalOpen(false);
      setImportRows([]);
      reloadData();
    } catch (err: any) {
      showToast('error', err?.message || 'ไม่สามารถนำเข้าข้อมูลได้');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            <span>จัดการสินค้า (Inventory)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            เพิ่ม แก้ไข ลบสินค้า ปรับ Stock และนำเข้าข้อมูลจากไฟล์ Excel
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 transition-all active:scale-98"
          >
            <Upload className="w-4 h-4" />
            <span>นำเข้า Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มสินค้า</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า หรือหมวดหมู่..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
        </div>

        <div>
          <select
            value={selectedCatFilter}
            onChange={(e) => setSelectedCatFilter(e.target.value)}
            className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          >
            <option value="ALL">หมวดหมู่ทั้งหมด ({items.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Items Table */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
            {items.length === 0 ? 'ยังไม่มีข้อมูลสินค้า' : 'ไม่พบสินค้าตามการค้นหา'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {items.length === 0
              ? 'เริ่มต้นระบบจะไม่มีสินค้าตัวอย่าง คลิก "เพิ่มสินค้า" หรือ "นำเข้า Excel" เพื่อเริ่มต้นใช้งาน'
              : 'ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อื่น'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 text-xs">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">ชื่อสินค้า</th>
                  <th className="py-3 px-4">หมวดหมู่</th>
                  <th className="py-3 px-4 text-right">คงเหลือ (Stock)</th>
                  <th className="py-3 px-4">หน่วย</th>
                  <th className="py-3 px-4 text-center w-28">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 text-center text-slate-400 font-mono text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {item.categoryName || 'ทั่วไป'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {item.stock}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {item.unit}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex justify-between">
            <span>แสดง {filteredItems.length} จากทั้งหมด {items.length} รายการ</span>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingItem ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อสินค้า <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น คะน้า, แตงกวา, หมูสันนอก"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  หมวดหมู่ <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" disabled>
                    -- เลือกหมวดหมู่ --
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    * ยังไม่มีหมวดหมู่ กรุณาไปเพิ่มหมวดหมู่ในเมนู "ตลาด/หมวดหมู่" ก่อน
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    คงเหลือ (Stock)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.stock}
                    onChange={(e) =>
                      setFormData({ ...formData, stock: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    หน่วย
                  </label>
                  <select
                    value={formData.unitPreset}
                    onChange={(e) => setFormData({ ...formData, unitPreset: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {PRESET_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.unitPreset === 'อื่นๆ' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ระบุหน่วยเอง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.unitCustom}
                    onChange={(e) => setFormData({ ...formData, unitCustom: e.target.value })}
                    placeholder="เช่น กำ, ถุง, แพ็ค, กล่อง"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="py-2.5 px-4 rounded-xl text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
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

      {/* Excel Import Preview Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ตัวอย่างข้อมูลก่อนนำเข้า Excel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-500 mb-3">
              ไฟล์: <strong className="text-slate-800 dark:text-slate-200">{importFileName}</strong>{' '}
              | จำนวน <strong className="text-emerald-600 font-bold">{importRows.length}</strong> รายการ
              (หากไม่มีหมวดหมู่ จะกำหนดเป็นหมวด "ทั่วไป" ให้อัตโนมัติ)
            </div>

            {/* Scrollable preview */}
            <div className="overflow-y-auto flex-1 border border-slate-200 dark:border-slate-800 rounded-xl mb-4">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold sticky top-0">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">ชื่อสินค้า</th>
                    <th className="py-2 px-3">หมวดหมู่</th>
                    <th className="py-2 px-3 text-right">Stock</th>
                    <th className="py-2 px-3">หน่วย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {importRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                        {r.name}
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                        {r.category || (
                          <span className="text-amber-600 italic">ทั่วไป (สร้างให้อัตโนมัติ)</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{r.stock ?? 0}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                        {r.unit || 'ชิ้น'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="py-2.5 px-5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-98 transition-all disabled:opacity-50"
              >
                {isImporting ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า ${importRows.length} รายการ`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog matching Requirement 13 */}
      <Dialog
        isOpen={!!itemToDelete}
        title="ลบสินค้า?"
        targetName={itemToDelete?.name}
        description="การลบข้อมูลนี้ไม่สามารถย้อนกลับได้"
        confirmLabel="ลบสินค้า"
        cancelLabel="ยกเลิก"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};
