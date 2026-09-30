import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Calendar,
  Store,
  User as UserIcon,
  Eye,
  Download,
  Image,
  FileText,
  PackageCheck,
  ChevronRight,
} from 'lucide-react';
import { User, Order } from '../types';
import { getOrders } from '../services/db';
import { formatThaiDateTime, downloadOrderPng, downloadOrderPdf } from '../utils/exportUtils';
import { ReceiptModal } from './ReceiptModal';

interface HistoryViewProps {
  currentUser: User;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ currentUser, showToast }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    // Load orders for current user role
    const loaded = getOrders(currentUser);
    setOrders(loaded);
  }, [currentUser]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.marketName.toLowerCase().includes(q) ||
        o.userName.toLowerCase().includes(q) ||
        (o.items || []).some((it) => it.itemName.toLowerCase().includes(q))
    );
  }, [orders, searchQuery]);

  const handleOpenReceipt = (order: Order) => {
    setSelectedOrder(order);
    setIsReceiptOpen(true);
  };

  const handleQuickPng = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    try {
      setExportingId(order.id + '_png');
      await downloadOrderPng(order);
      showToast('success', 'ดาวน์โหลดภาพ PNG เรียบร้อยแล้ว');
    } catch (err: any) {
      showToast('error', 'ไม่สามารถดาวน์โหลด PNG ได้: ' + (err?.message || 'ข้อผิดพลาด'));
    } finally {
      setExportingId(null);
    }
  };

  const handleQuickPdf = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    try {
      setExportingId(order.id + '_pdf');
      await downloadOrderPdf(order);
      showToast('success', 'ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว');
    } catch (err: any) {
      showToast('error', 'ไม่สามารถดาวน์โหลด PDF ได้: ' + (err?.message || 'ข้อผิดพลาด'));
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
            <span>ประวัติคำสั่งซื้อ</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {currentUser.role === 1
              ? 'แสดงคำสั่งซื้อทั้งหมดในระบบ (สิทธิ์ Admin)'
              : 'แสดงเฉพาะคำสั่งซื้อของคุณ'}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาเลขที่, ตลาด, ผู้สั่ง..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
          <PackageCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
            ยังไม่มีประวัติคำสั่งซื้อ
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            เมื่อสั่งซื้อสินค้า รายการจะถูกบันทึกและแสดงที่นี่อัตโนมัติ
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const totalQty = (order.items || []).reduce(
              (sum, it) => sum + (Number(it.quantity) || 0),
              0
            );

            return (
              <div
                key={order.id}
                onClick={() => handleOpenReceipt(order)}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all shadow-xs hover:shadow-md cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Left Info */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      {order.orderNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {order.marketName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{order.userName}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatThaiDateTime(order.createdAt)}</span>
                    </div>

                    <div className="font-medium text-slate-700 dark:text-slate-300">
                      {order.items?.length || 0} รายการ ({totalQty} ชิ้น/หน่วย)
                    </div>
                  </div>

                  {/* Sample items preview */}
                  <div className="text-xs text-slate-400 truncate max-w-xl">
                    {(order.items || [])
                      .slice(0, 3)
                      .map((it) => `${it.itemName} (${it.quantity} ${it.unit})`)
                      .join(', ')}
                    {(order.items || []).length > 3 && ' และอื่นๆ...'}
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={(e) => handleQuickPng(e, order)}
                    disabled={exportingId === order.id + '_png'}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
                    title="ดาวน์โหลดภาพ PNG (คำนวณความสูงจริง ไม่ตัดรายการ)"
                  >
                    <Image className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{exportingId === order.id + '_png' ? '...' : 'PNG'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleQuickPdf(e, order)}
                    disabled={exportingId === order.id + '_pdf'}
                    className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 active:scale-95 transition-all"
                    title="ดาวน์โหลด PDF"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-600" />
                    <span>{exportingId === order.id + '_pdf' ? '...' : 'PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenReceipt(order)}
                    className="flex items-center gap-1 py-1.5 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">ดูใบรายการ</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Re-usable Receipt Modal */}
      <ReceiptModal
        order={selectedOrder}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        showToast={showToast}
      />
    </div>
  );
};
