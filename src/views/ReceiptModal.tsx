import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  Image,
  CheckCircle2,
  Calendar,
  Store,
  User as UserIcon,
  Hash,
} from 'lucide-react';
import { Order } from '../types';
import { formatThaiDateTime, downloadOrderPng, downloadOrderPdf } from '../utils/exportUtils';

interface ReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  order,
  isOpen,
  onClose,
  showToast,
}) => {
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  if (!isOpen || !order) return null;

  const totalQuantity = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const handleDownloadPng = async () => {
    try {
      setIsExportingPng(true);
      await downloadOrderPng(order);
      showToast('success', 'ดาวน์โหลดไฟล์ภาพ PNG เรียบร้อยแล้ว (ข้อมูลครบทุกรายการ)');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'ไม่สามารถสร้างไฟล์ PNG ได้: ' + (err?.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      await downloadOrderPdf(order);
      showToast('success', 'ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว (จัดหน้าอัตโนมัติ ไม่ตัดข้อมูล)');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'ไม่สามารถสร้างไฟล์ PDF ได้: ' + (err?.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                ใบสั่งซื้อสินค้า (Order Sheet)
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                {order.orderNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {/* Metadata Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-slate-500">เลขที่:</span>
              <span className="font-semibold text-slate-900 dark:text-white font-mono">
                {order.orderNumber}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-slate-500">ตลาด:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {order.marketName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-slate-500">สั่งโดย:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {order.userName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-slate-500">วัน/เวลา:</span>
              <span className="text-slate-700 dark:text-slate-300">
                {formatThaiDateTime(order.createdAt)}
              </span>
            </div>

            {order.note && (
              <div className="sm:col-span-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="font-medium text-slate-700 dark:text-slate-300">หมายเหตุ: </span>
                {order.note}
              </div>
            )}
          </div>

          {/* Table Container */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3 text-center w-12">#</th>
                    <th className="py-2.5 px-3">หมวดหมู่</th>
                    <th className="py-2.5 px-3">ชื่อสินค้า</th>
                    <th className="py-2.5 px-3 text-right">คงเหลือ</th>
                    <th className="py-2.5 px-3 text-right">สั่ง</th>
                    <th className="py-2.5 px-3">หน่วย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {order.items.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs">
                          {item.categoryName || 'ทั่วไป'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                        {item.itemName}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500 font-mono">
                        {item.stockBefore ?? 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm sm:text-base">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer Summary */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs sm:text-sm">
              <span className="font-medium text-emerald-900 dark:text-emerald-200">
                รวม {order.items.length} รายการ
              </span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                ยอดสั่งรวม: {totalQuantity} ชิ้น/หน่วย
              </span>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isExportingPng}
            className="flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-xs transition-all disabled:opacity-50"
            title="สร้างภาพ PNG ที่คำนวณความสูงตามข้อมูลจริง ไม่ตัดรายการด้านล่าง"
          >
            <Image className="w-4 h-4" />
            <span>{isExportingPng ? 'กำลังสร้าง PNG...' : 'ดาวน์โหลด PNG'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-2 py-2 px-3.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 active:scale-98 text-white shadow-xs transition-all disabled:opacity-50"
            title="สร้าง PDF แบ่งหลายหน้า A4 อัตโนมัติ"
          >
            <FileText className="w-4 h-4" />
            <span>{isExportingPdf ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl text-xs sm:text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
