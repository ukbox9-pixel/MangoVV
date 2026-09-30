import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Store,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Check,
  RotateCcw,
  Send,
  AlertCircle,
  FileText,
  Filter,
  Package,
} from 'lucide-react';
import { User, Market, Category, Item, Order } from '../types';
import { getMarkets, getCategories, getItems, createOrder } from '../services/db';

interface OrderViewProps {
  currentUser: User;
  showToast: (type: 'success' | 'error', message: string) => void;
  onOrderCreated: (order: Order) => void;
}

const STORAGE_LAST_MARKET = 'hpp_last_market_id';
const STORAGE_LAST_CATEGORY = 'hpp_last_category_id';

export const OrderView: React.FC<OrderViewProps> = ({
  currentUser,
  showToast,
  onOrderCreated,
}) => {
  // Load data
  const [markets, setMarkets] = useState<Market[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Selection states
  const [selectedMarketId, setSelectedMarketId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart: Map of itemId -> ordered quantity (EXACT SINGLE NUMBER)
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [orderNote, setOrderNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const submitLockRef = useRef<boolean>(false);

  // Load initial data
  useEffect(() => {
    const loadedMarkets = getMarkets();
    const loadedCategories = getCategories();
    const loadedItems = getItems();

    setMarkets(loadedMarkets);
    setCategories(loadedCategories);
    setItems(loadedItems);

    // Filter markets accessible to this user
    const accessibleMarkets =
      currentUser.role === 1 || !currentUser.marketIds || currentUser.marketIds.length === 0
        ? loadedMarkets
        : loadedMarkets.filter((m) => currentUser.marketIds?.includes(m.id));

    // Restore last active market filter from localStorage
    const savedMarketId = localStorage.getItem(STORAGE_LAST_MARKET);
    if (savedMarketId && accessibleMarkets.some((m) => m.id === savedMarketId)) {
      setSelectedMarketId(savedMarketId);
    } else if (accessibleMarkets.length > 0) {
      setSelectedMarketId(accessibleMarkets[0].id);
    }

    // Restore last active category filter from localStorage
    const savedCategoryId = localStorage.getItem(STORAGE_LAST_CATEGORY);
    if (savedCategoryId) {
      setSelectedCategoryId(savedCategoryId);
    }
  }, [currentUser]);

  // Persist last selected market
  const handleSelectMarket = (marketId: string) => {
    setSelectedMarketId(marketId);
    try {
      localStorage.setItem(STORAGE_LAST_MARKET, marketId);
    } catch {}
  };

  // Persist last selected category
  const handleSelectCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    try {
      localStorage.setItem(STORAGE_LAST_CATEGORY, catId);
    } catch {}
  };

  // Accessible markets for this user
  const userMarkets = useMemo(() => {
    if (currentUser.role === 1 || !currentUser.marketIds || currentUser.marketIds.length === 0) {
      return markets;
    }
    return markets.filter((m) => currentUser.marketIds?.includes(m.id));
  }, [markets, currentUser]);

  const currentMarket = useMemo(() => {
    return markets.find((m) => m.id === selectedMarketId);
  }, [markets, selectedMarketId]);

  // Filter categories allowed in the current market
  const availableCategories = useMemo(() => {
    if (!currentMarket) return categories;
    if (!currentMarket.categoryIds || currentMarket.categoryIds.length === 0) {
      // If no explicit binding, show all categories
      return categories;
    }
    return categories.filter((c) => currentMarket.categoryIds.includes(c.id));
  }, [categories, currentMarket]);

  // Filtered items based on market, category, and search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category check
      if (selectedCategoryId !== 'ALL' && item.categoryId !== selectedCategoryId) {
        return false;
      }

      // If category is set to ALL, but market has restricted categories, check that
      if (
        selectedCategoryId === 'ALL' &&
        currentMarket?.categoryIds &&
        currentMarket.categoryIds.length > 0 &&
        !currentMarket.categoryIds.includes(item.categoryId)
      ) {
        return false;
      }

      // Search query check (name or category name)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = item.name.toLowerCase().includes(query);
        const matchCat = (item.categoryName || '').toLowerCase().includes(query);
        if (!matchName && !matchCat) return false;
      }

      return true;
    });
  }, [items, selectedCategoryId, currentMarket, searchQuery]);

  // Quantity helpers - ALWAYS SINGLE NUMBERS
  const handleQuantityChange = (itemId: string, val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      setCartQuantities((prev) => {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      });
    } else {
      setCartQuantities((prev) => ({
        ...prev,
        [itemId]: num,
      }));
    }
  };

  const handleIncrement = (itemId: string) => {
    setCartQuantities((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  };

  const handleDecrement = (itemId: string) => {
    setCartQuantities((prev) => {
      const current = prev[itemId] || 0;
      if (current <= 1) {
        const updated = { ...prev };
        delete updated[itemId];
        return updated;
      }
      return {
        ...prev,
        [itemId]: current - 1,
      };
    });
  };

  const handleClearCart = () => {
    setCartQuantities({});
    setOrderNote('');
  };

  // Cart summary
  const cartItemEntries = useMemo(() => {
    return Object.entries(cartQuantities)
      .map(([itemId, qty]) => {
        const item = items.find((i) => i.id === itemId);
        return item ? { item, quantity: qty } : null;
      })
      .filter(Boolean) as Array<{ item: Item; quantity: number }>;
  }, [cartQuantities, items]);

  const totalOrderedCount = cartItemEntries.length;
  const totalOrderedQuantity = cartItemEntries.reduce((sum, entry) => sum + entry.quantity, 0);

  // Submit Order with strict multi-click debounce lock
  const handleSubmitOrder = async () => {
    if (submitLockRef.current || isSubmitting) return;

    if (!selectedMarketId) {
      showToast('error', 'กรุณาเลือกตลาดก่อนสั่งซื้อ');
      return;
    }

    if (cartItemEntries.length === 0) {
      showToast('error', 'กรุณาระบุจำนวนสินค้าที่ต้องการสั่งอย่างน้อย 1 รายการ');
      return;
    }

    try {
      submitLockRef.current = true;
      setIsSubmitting(true);

      const order = await createOrder(
        selectedMarketId,
        currentUser,
        cartItemEntries,
        orderNote.trim()
      );

      // Refresh items stock in view
      setItems(getItems());

      showToast('success', `✓ บันทึกสำเร็จ - เลขที่ ${order.orderNumber}`);
      handleClearCart();
      onOrderCreated(order);
    } catch (err: any) {
      console.error(err);
      showToast('error', err?.message || 'ไม่สามารถบันทึกคำสั่งซื้อได้');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-32">
      {/* 1. Market Selection Header */}
      <div className="mb-6 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-xs border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Store className="w-6 h-6 text-emerald-600" />
              <span>สั่งซื้อสินค้า</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              เลือกลำดับ: ตลาด → หมวดหมู่ → ค้นหาสินค้า → ระบุจำนวน → ส่งรายการ
            </p>
          </div>

          {/* Market Selector Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {userMarkets.length === 0 ? (
              <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                ยังไม่มีข้อมูลตลาด (กรุณาให้ Admin เพิ่มตลาดในระบบก่อน)
              </span>
            ) : (
              userMarkets.map((market) => {
                const isSelected = selectedMarketId === market.id;
                return (
                  <button
                    key={market.id}
                    onClick={() => handleSelectMarket(market.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap active:scale-98 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {market.name}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 2. Search & Category Filters (Remembered automatically) */}
      <div className="mb-6 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อสินค้า หรือหมวดหมู่..."
            className="w-full pl-11 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md"
            >
              ล้าง
            </button>
          )}
        </div>

        {/* Category Pills with auto-save */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => handleSelectCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              selectedCategoryId === 'ALL'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            ทั้งหมด ({items.length})
          </button>

          {availableCategories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            const count = items.filter((it) => it.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Items Grid / List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
            {items.length === 0 ? 'ยังไม่มีรายการสินค้าในระบบ' : 'ไม่พบสินค้าตามเงื่อนไขที่เลือก'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {items.length === 0
              ? 'ระบบเริ่มต้นไม่มีข้อมูลสินค้าตัวอย่าง ผู้ดูแลระบบ (Admin) สามารถเพิ่มสินค้าหรือนำเข้าจาก Excel ได้ที่เมนู "จัดการสินค้า"'
              : 'ลองเปลี่ยนคำค้นหา หรือเลือกหมวดหมู่อื่น'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredItems.map((item) => {
            const orderedQty = cartQuantities[item.id] || 0;
            const isOrdered = orderedQty > 0;

            return (
              <div
                key={item.id}
                className={`relative bg-white dark:bg-slate-900 rounded-2xl p-4 border transition-all duration-150 flex flex-col justify-between ${
                  isOrdered
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {item.categoryName || 'ทั่วไป'}
                    </span>
                    <span className="text-xs text-slate-500">
                      คงเหลือ: <strong className="text-slate-700 dark:text-slate-200 font-mono">{item.stock}</strong> {item.unit}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                    {item.name}
                  </h3>
                </div>

                {/* Single Quantity Input Controls (Requirement: 'สั่ง' ต้องเป็นจำนวนเดียว) */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-500">
                    สั่ง ({item.unit}):
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDecrement(item.id)}
                      disabled={orderedQty <= 0}
                      className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={orderedQty === 0 ? '' : orderedQty}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      placeholder="0"
                      className={`w-16 h-9 rounded-xl text-center font-bold text-base border focus:outline-none transition-all font-mono ${
                        isOrdered
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white'
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => handleIncrement(item.id)}
                      className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-300 flex items-center justify-center active:scale-95 transition-all"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Bottom Sticky Cart & Submit Drawer */}
      {totalOrderedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-2xl p-4 animate-in slide-in-from-bottom duration-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Summary details */}
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-700/30">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>เลือก {totalOrderedCount} รายการ</span>
                    <span className="text-emerald-600 font-extrabold font-mono">
                      (รวม {totalOrderedQuantity} ชิ้น/หน่วย)
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    ตลาด: <span className="font-semibold text-slate-700 dark:text-slate-300">{currentMarket?.name || 'ทั่วไป'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearCart}
                className="text-xs text-slate-500 hover:text-rose-600 flex items-center gap-1 p-1 rounded-lg transition-colors"
                title="ล้างรายการที่เลือก"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ล้าง</span>
              </button>
            </div>

            {/* Note & Submit Button with debounced click lock */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <input
                type="text"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)..."
                className="flex-1 sm:w-60 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />

              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
                className="py-2.5 px-5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white shadow-lg shadow-emerald-700/30 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'ส่งรายการ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
