import {
  Market,
  Category,
  Item,
  User,
  Order,
  OrderItem,
  HistoryLog,
  AppSettings,
} from '../types';
import {
  readAllTablesFromSheet,
  overwriteSheetRows,
  appendSheetRow,
} from './sheets';
import { getAccessToken } from './auth';

// Storage Keys
const STORAGE_PREFIX = 'hpp_app_';
const KEY_MARKETS = `${STORAGE_PREFIX}markets`;
const KEY_CATEGORIES = `${STORAGE_PREFIX}categories`;
const KEY_ITEMS = `${STORAGE_PREFIX}items`;
const KEY_USERS = `${STORAGE_PREFIX}users`;
const KEY_ORDERS = `${STORAGE_PREFIX}orders`;
const KEY_SETTINGS = `${STORAGE_PREFIX}settings`;
const KEY_HISTORY = `${STORAGE_PREFIX}history`;

// Default initial admin (created automatically if users is empty)
export const DEFAULT_ADMIN: User = {
  id: 'user_admin_001',
  name: 'ผู้ดูแลระบบ (Admin)',
  pin: '0000',
  role: 1, // Admin
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
};

// In-Memory cache for lightning-fast ("กดแล้วต้องไป") performance
let cacheMarkets: Market[] = [];
let cacheCategories: Category[] = [];
let cacheItems: Item[] = [];
let cacheUsers: User[] = [DEFAULT_ADMIN];
let cacheOrders: Order[] = [];
let cacheSettings: AppSettings = {};
let cacheHistory: HistoryLog[] = [];
let isInitialized = false;

// Helpers for localStorage
function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to local storage', e);
  }
}

/**
 * Initializes in-memory cache from LocalStorage immediately,
 * ensuring no delay on startup.
 */
export function initLocalData() {
  if (isInitialized) return;

  cacheMarkets = loadLocal<Market[]>(KEY_MARKETS, []);
  cacheCategories = loadLocal<Category[]>(KEY_CATEGORIES, []);
  cacheItems = loadLocal<Item[]>(KEY_ITEMS, []);
  cacheUsers = loadLocal<User[]>(KEY_USERS, [DEFAULT_ADMIN]);
  cacheOrders = loadLocal<Order[]>(KEY_ORDERS, []);
  cacheSettings = loadLocal<AppSettings>(KEY_SETTINGS, {});
  cacheHistory = loadLocal<HistoryLog[]>(KEY_HISTORY, []);

  // Ensure default admin always exists if users array is empty
  if (cacheUsers.length === 0) {
    cacheUsers = [DEFAULT_ADMIN];
    saveLocal(KEY_USERS, cacheUsers);
  } else {
    // Check if admin 0000 exists
    const hasAdmin = cacheUsers.some((u) => u.pin === '0000' && u.role === 1);
    if (!hasAdmin) {
      cacheUsers.unshift(DEFAULT_ADMIN);
      saveLocal(KEY_USERS, cacheUsers);
    }
  }

  isInitialized = true;
}

// Ensure local data is initialized immediately when script evaluates
initLocalData();

export function getSettings(): AppSettings {
  return cacheSettings;
}

export function saveSettings(settings: AppSettings): void {
  cacheSettings = { ...cacheSettings, ...settings };
  saveLocal(KEY_SETTINGS, cacheSettings);
}

// -------------------------------------------------------------
// Google Sheets Synchronization
// -------------------------------------------------------------

/**
 * Syncs full data from Google Sheets into local cache
 */
export async function syncFromGoogleSheets(): Promise<{ success: boolean; message: string }> {
  const spreadsheetId = cacheSettings.spreadsheetId;
  if (!spreadsheetId) {
    return { success: false, message: 'ยังไม่ได้ระบุ Google Spreadsheet ID' };
  }

  const token = await getAccessToken();
  if (!token) {
    return { success: false, message: 'Google Account ยังไม่ได้เข้าสู่ระบบ' };
  }

  try {
    const tables = await readAllTablesFromSheet(spreadsheetId);

    // 1. Markets
    const rawMarkets = tables['Markets'] || [];
    cacheMarkets = rawMarkets
      .filter((row) => row[0])
      .map((row) => ({
        id: row[0],
        name: row[1] || '',
        description: row[2] || '',
        categoryIds: row[3] ? row[3].split(',').filter(Boolean) : [],
        createdAt: row[4] || new Date().toISOString(),
      }));
    saveLocal(KEY_MARKETS, cacheMarkets);

    // 2. Categories
    const rawCategories = tables['Categories'] || [];
    cacheCategories = rawCategories
      .filter((row) => row[0])
      .map((row) => ({
        id: row[0],
        name: row[1] || '',
        createdAt: row[2] || new Date().toISOString(),
      }));
    saveLocal(KEY_CATEGORIES, cacheCategories);

    // 3. Items
    const rawItems = tables['Items'] || [];
    cacheItems = rawItems
      .filter((row) => row[0])
      .map((row) => ({
        id: row[0],
        name: row[1] || '',
        categoryId: row[2] || '',
        categoryName: row[3] || '',
        stock: Number(row[4]) || 0,
        unit: row[5] || 'ชิ้น',
        createdAt: row[6] || new Date().toISOString(),
      }));
    saveLocal(KEY_ITEMS, cacheItems);

    // 4. Users
    const rawUsers = tables['Users'] || [];
    const parsedUsers: User[] = rawUsers
      .filter((row) => row[0])
      .map((row) => {
        let pin = String(row[2] || '').trim();
        // Remove leading quote if Google Sheets preserved text format
        if (pin.startsWith("'")) pin = pin.slice(1);
        // Pad 4 digits if needed
        if (pin.length < 4) pin = pin.padStart(4, '0');

        return {
          id: row[0],
          name: row[1] || '',
          pin,
          role: Number(row[3]) === 1 ? 1 : 0,
          status: (row[4] === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
          marketIds: row[5] ? row[5].split(',').filter(Boolean) : [],
          createdAt: row[6] || new Date().toISOString(),
        };
      });

    // Ensure default admin exists
    if (!parsedUsers.some((u) => u.pin === '0000')) {
      parsedUsers.unshift(DEFAULT_ADMIN);
    }
    cacheUsers = parsedUsers;
    saveLocal(KEY_USERS, cacheUsers);

    // 5. Orders & OrderItems
    const rawOrders = tables['Orders'] || [];
    const rawOrderItems = tables['OrderItems'] || [];

    const orderItemsMap: Record<string, OrderItem[]> = {};
    rawOrderItems.forEach((row) => {
      if (!row[0] || !row[1]) return;
      const orderId = row[1];
      if (!orderItemsMap[orderId]) orderItemsMap[orderId] = [];
      orderItemsMap[orderId].push({
        id: row[0],
        orderId,
        itemId: row[2] || '',
        itemName: row[3] || '',
        categoryName: row[4] || '',
        stockBefore: Number(row[5]) || 0,
        quantity: Number(row[6]) || 0,
        unit: row[7] || '',
      });
    });

    cacheOrders = rawOrders
      .filter((row) => row[0])
      .map((row) => {
        const orderId = row[0];
        return {
          id: orderId,
          orderNumber: row[1] || '',
          marketId: row[2] || '',
          marketName: row[3] || '',
          userId: row[4] || '',
          userName: row[5] || '',
          totalItems: Number(row[6]) || 0,
          createdAt: row[7] || new Date().toISOString(),
          note: row[8] || '',
          items: orderItemsMap[orderId] || [],
        };
      });
    saveLocal(KEY_ORDERS, cacheOrders);

    cacheSettings.lastSyncTime = new Date().toISOString();
    saveLocal(KEY_SETTINGS, cacheSettings);

    return { success: true, message: 'ซิงค์ข้อมูลกับ Google Sheets สำเร็จ' };
  } catch (error: any) {
    console.error('Error syncing from Google Sheets:', error);
    return { success: false, message: error?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' };
  }
}

/**
 * Pushes entire local database to Google Sheets
 */
export async function pushAllToGoogleSheets(): Promise<void> {
  const spreadsheetId = cacheSettings.spreadsheetId;
  if (!spreadsheetId) return;

  const token = await getAccessToken();
  if (!token) return;

  try {
    // 1. Markets
    const marketRows = cacheMarkets.map((m) => [
      m.id,
      m.name,
      m.description || '',
      (m.categoryIds || []).join(','),
      m.createdAt,
    ]);
    await overwriteSheetRows(spreadsheetId, 'Markets', marketRows);

    // 2. Categories
    const categoryRows = cacheCategories.map((c) => [c.id, c.name, c.createdAt]);
    await overwriteSheetRows(spreadsheetId, 'Categories', categoryRows);

    // 3. CategoryMarkets
    const catMarketRows: string[][] = [];
    cacheMarkets.forEach((m) => {
      (m.categoryIds || []).forEach((cId) => {
        catMarketRows.push([cId, m.id]);
      });
    });
    await overwriteSheetRows(spreadsheetId, 'CategoryMarkets', catMarketRows);

    // 4. Items
    const itemRows = cacheItems.map((item) => [
      item.id,
      item.name,
      item.categoryId,
      item.categoryName || '',
      item.stock,
      item.unit,
      item.createdAt,
    ]);
    await overwriteSheetRows(spreadsheetId, 'Items', itemRows);

    // 5. Users (format PIN with ' to preserve leading zeros e.g. '0000)
    const userRows = cacheUsers.map((u) => [
      u.id,
      u.name,
      `'${u.pin}`, // Preserves '0000' in Google Sheets
      u.role,
      u.status,
      (u.marketIds || []).join(','),
      u.createdAt,
    ]);
    await overwriteSheetRows(spreadsheetId, 'Users', userRows);

    // 6. Orders & OrderItems
    const orderRows = cacheOrders.map((o) => [
      o.id,
      o.orderNumber,
      o.marketId,
      o.marketName,
      o.userId,
      o.userName,
      o.totalItems,
      o.createdAt,
      o.note || '',
    ]);
    await overwriteSheetRows(spreadsheetId, 'Orders', orderRows);

    const orderItemRows: (string | number)[][] = [];
    cacheOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        orderItemRows.push([
          item.id,
          item.orderId,
          item.itemId,
          item.itemName,
          item.categoryName,
          item.stockBefore,
          item.quantity,
          item.unit,
        ]);
      });
    });
    await overwriteSheetRows(spreadsheetId, 'OrderItems', orderItemRows);

    cacheSettings.lastSyncTime = new Date().toISOString();
    saveLocal(KEY_SETTINGS, cacheSettings);
  } catch (error) {
    console.error('Failed to push to Google Sheets:', error);
  }
}

// -------------------------------------------------------------
// CRUD Operations
// -------------------------------------------------------------

// --- MARKETS ---
export function getMarkets(): Market[] {
  return [...cacheMarkets];
}

export async function saveMarket(market: Omit<Market, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<Market> {
  const isEdit = !!market.id;
  const id = market.id || `mkt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const fullMarket: Market = {
    ...market,
    id,
    categoryIds: market.categoryIds || [],
    createdAt: market.createdAt || new Date().toISOString(),
  };

  if (isEdit) {
    cacheMarkets = cacheMarkets.map((m) => (m.id === id ? fullMarket : m));
  } else {
    cacheMarkets.push(fullMarket);
  }
  saveLocal(KEY_MARKETS, cacheMarkets);

  // Sync to sheets asynchronously
  if (cacheSettings.spreadsheetId) {
    const marketRows = cacheMarkets.map((m) => [
      m.id,
      m.name,
      m.description || '',
      (m.categoryIds || []).join(','),
      m.createdAt,
    ]);
    overwriteSheetRows(cacheSettings.spreadsheetId, 'Markets', marketRows).catch(console.error);
  }

  return fullMarket;
}

export async function deleteMarket(marketId: string): Promise<void> {
  cacheMarkets = cacheMarkets.filter((m) => m.id !== marketId);
  saveLocal(KEY_MARKETS, cacheMarkets);

  if (cacheSettings.spreadsheetId) {
    const marketRows = cacheMarkets.map((m) => [
      m.id,
      m.name,
      m.description || '',
      (m.categoryIds || []).join(','),
      m.createdAt,
    ]);
    overwriteSheetRows(cacheSettings.spreadsheetId, 'Markets', marketRows).catch(console.error);
  }
}

// --- CATEGORIES ---
export function getCategories(): Category[] {
  return [...cacheCategories];
}

export async function saveCategory(category: { id?: string; name: string }): Promise<Category> {
  const trimmedName = category.name.trim();
  if (!trimmedName) throw new Error('กรุณาระบุชื่อหมวดหมู่');

  const isEdit = !!category.id;
  const id = category.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const fullCategory: Category = {
    id,
    name: trimmedName,
    createdAt: new Date().toISOString(),
  };

  if (isEdit) {
    cacheCategories = cacheCategories.map((c) => (c.id === id ? fullCategory : c));
    // Update category name in items as well
    cacheItems = cacheItems.map((item) =>
      item.categoryId === id ? { ...item, categoryName: trimmedName } : item
    );
    saveLocal(KEY_ITEMS, cacheItems);
  } else {
    cacheCategories.push(fullCategory);
  }
  saveLocal(KEY_CATEGORIES, cacheCategories);

  if (cacheSettings.spreadsheetId) {
    const categoryRows = cacheCategories.map((c) => [c.id, c.name, c.createdAt]);
    overwriteSheetRows(cacheSettings.spreadsheetId, 'Categories', categoryRows).catch(console.error);
  }

  return fullCategory;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  cacheCategories = cacheCategories.filter((c) => c.id !== categoryId);
  saveLocal(KEY_CATEGORIES, cacheCategories);

  // Remove category from markets
  cacheMarkets = cacheMarkets.map((m) => ({
    ...m,
    categoryIds: m.categoryIds.filter((cId) => cId !== categoryId),
  }));
  saveLocal(KEY_MARKETS, cacheMarkets);

  if (cacheSettings.spreadsheetId) {
    const categoryRows = cacheCategories.map((c) => [c.id, c.name, c.createdAt]);
    overwriteSheetRows(cacheSettings.spreadsheetId, 'Categories', categoryRows).catch(console.error);
  }
}

// --- ITEMS ---
export function getItems(): Item[] {
  return [...cacheItems];
}

export async function saveItem(item: Omit<Item, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<Item> {
  const trimmedName = item.name.trim();
  if (!trimmedName) throw new Error('กรุณาระบุชื่อสินค้า');

  const isEdit = !!item.id;
  const id = item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

  const category = cacheCategories.find((c) => c.id === item.categoryId);
  const categoryName = category ? category.name : item.categoryName || 'ทั่วไป';

  const fullItem: Item = {
    ...item,
    id,
    name: trimmedName,
    categoryId: item.categoryId,
    categoryName,
    stock: Number(item.stock) || 0,
    unit: item.unit.trim() || 'ชิ้น',
    createdAt: item.createdAt || new Date().toISOString(),
  };

  if (isEdit) {
    cacheItems = cacheItems.map((it) => (it.id === id ? fullItem : it));
  } else {
    cacheItems.push(fullItem);
  }
  saveLocal(KEY_ITEMS, cacheItems);

  if (cacheSettings.spreadsheetId) {
    const itemRows = cacheItems.map((it) => [
      it.id,
      it.name,
      it.categoryId,
      it.categoryName || '',
      it.stock,
      it.unit,
      it.createdAt,
    ]);
    overwriteSheetRows(cacheSettings.spreadsheetId, 'Items', itemRows).catch(console.error);
  }

  return fullItem;
}

export async function deleteItem(itemId: string): Promise<void> {
  cacheItems = cacheItems.filter((it) => it.id !== itemId);
  saveLocal(KEY_ITEMS, cacheItems);

  if (cacheSettings.spreadsheetId) {
    const itemRows = cacheItems.map((it) => [
      it.id,
      it.name,
      it.categoryId,
      it.categoryName || '',
      it.stock,
      it.unit,
      it.createdAt,
    ]);
    overwriteSheetRows(cacheSettings.spreadsheetId, 'Items', itemRows).catch(console.error);
  }
}

/**
 * Excel Import processor:
 * - Columns: ชื่อ, หมวดหมู่, stock, หน่วย
 * - If category column missing or empty: fallback to "ทั่วไป"
 * - Auto-creates missing categories
 * - Deduplicates items by name + category
 */
export async function importItemsFromExcel(
  rows: Array<{
    name: string;
    category?: string;
    stock?: number | string;
    unit?: string;
  }>
): Promise<{ added: number; updated: number; categoriesCreated: number }> {
  if (!rows || rows.length === 0) {
    throw new Error('ไม่พบข้อมูลในไฟล์ Excel');
  }

  let categoriesCreated = 0;
  let added = 0;
  let updated = 0;

  // Track existing categories
  const categoryMapByName = new Map<string, Category>();
  cacheCategories.forEach((cat) => {
    categoryMapByName.set(cat.name.trim().toLowerCase(), cat);
  });

  for (const row of rows) {
    const itemName = String(row.name || '').trim();
    if (!itemName) continue;

    let catName = String(row.category || '').trim();
    if (!catName) {
      catName = 'ทั่วไป';
    }

    const catKey = catName.toLowerCase();
    let category = categoryMapByName.get(catKey);

    if (!category) {
      category = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: catName,
        createdAt: new Date().toISOString(),
      };
      cacheCategories.push(category);
      categoryMapByName.set(catKey, category);
      categoriesCreated++;
    }

    const stock = Number(row.stock) || 0;
    const unit = String(row.unit || 'ชิ้น').trim();

    // Check if item exists (match by name & category)
    const existingIndex = cacheItems.findIndex(
      (it) => it.name.trim().toLowerCase() === itemName.toLowerCase() && it.categoryId === category!.id
    );

    if (existingIndex >= 0) {
      cacheItems[existingIndex] = {
        ...cacheItems[existingIndex],
        stock,
        unit,
        categoryName: category.name,
      };
      updated++;
    } else {
      cacheItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: itemName,
        categoryId: category.id,
        categoryName: category.name,
        stock,
        unit,
        createdAt: new Date().toISOString(),
      });
      added++;
    }
  }

  saveLocal(KEY_CATEGORIES, cacheCategories);
  saveLocal(KEY_ITEMS, cacheItems);

  if (cacheSettings.spreadsheetId) {
    pushAllToGoogleSheets().catch(console.error);
  }

  return { added, updated, categoriesCreated };
}

// --- USERS ---
export function getUsers(): User[] {
  return [...cacheUsers];
}

/**
 * Validates and saves a User.
 * Requirement:
 * - Duplicate Name is ALLOWED
 * - Duplicate PIN is FORBIDDEN
 * - Shows clear descriptive error if duplicate PIN
 */
export async function saveUser(user: Omit<User, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<User> {
  const trimmedName = user.name.trim();
  let trimmedPin = user.pin.trim();

  if (!trimmedName) throw new Error('กรุณาระบุชื่อผู้ใช้งาน');
  if (!trimmedPin) throw new Error('กรุณาระบุรหัส PIN');

  // Ensure 4 digits
  if (trimmedPin.length !== 4 || !/^\d{4}$/.test(trimmedPin)) {
    throw new Error('รหัส PIN ต้องเป็นตัวเลข 4 หลักเท่านั้น เช่น 1234');
  }

  const isEdit = !!user.id;

  // Check PIN duplicate
  const pinDuplicate = cacheUsers.find((u) => u.pin === trimmedPin && (!isEdit || u.id !== user.id));
  if (pinDuplicate) {
    throw new Error(`ไม่สามารถบันทึกได้ - PIN "${trimmedPin}" นี้ถูกใช้งานแล้ว โดย "${pinDuplicate.name}"`);
  }

  const id = user.id || `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const fullUser: User = {
    id,
    name: trimmedName,
    pin: trimmedPin,
    role: user.role,
    status: user.status || 'ACTIVE',
    marketIds: user.marketIds || [],
    createdAt: user.createdAt || new Date().toISOString(),
  };

  if (isEdit) {
    cacheUsers = cacheUsers.map((u) => (u.id === id ? fullUser : u));
  } else {
    cacheUsers.push(fullUser);
  }
  saveLocal(KEY_USERS, cacheUsers);

  if (cacheSettings.spreadsheetId) {
    const userRows = cacheUsers.map((u) => [
      u.id,
      u.name,
      `'${u.pin}`, // Preserves '0000'
      u.role,
      u.status,
      (u.marketIds || []).join(','),
      u.createdAt,
    ]);
    overwriteSheetRows(cacheSettings.spreadsheetId, 'Users', userRows).catch(console.error);
  }

  return fullUser;
}

export async function deleteUser(userId: string): Promise<void> {
  // Prevent deleting the last admin or default admin
  const user = cacheUsers.find((u) => u.id === userId);
  if (user?.pin === '0000') {
    throw new Error('ไม่สามารถลบบัญชีผู้ดูแลระบบหลัก (Admin 0000) ได้');
  }

  cacheUsers = cacheUsers.filter((u) => u.id !== userId);
  saveLocal(KEY_USERS, cacheUsers);

  if (cacheSettings.spreadsheetId) {
    const userRows = cacheUsers.map((u) => [
      u.id,
      u.name,
      `'${u.pin}`,
      u.role,
      u.status,
      (u.marketIds || []).join(','),
      u.createdAt,
    ]);
    overwriteSheetRows(cacheSettings.spreadsheetId, 'Users', userRows).catch(console.error);
  }
}

export function findUserByPin(pin: string): User | null {
  const cleanPin = pin.trim();
  const user = cacheUsers.find((u) => u.pin === cleanPin);
  if (!user || user.status !== 'ACTIVE') return null;
  return user;
}

// --- ORDERS ---
export function getOrders(user?: User | null): Order[] {
  if (!user) return [];
  // Admin sees all, Standard User sees only their own
  if (user.role === 1) {
    return [...cacheOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  return cacheOrders
    .filter((o) => o.userId === user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getOrderById(orderId: string): Order | null {
  return cacheOrders.find((o) => o.id === orderId) || null;
}

/**
 * Creates an order and saves items.
 * Requirement:
 * - Order Number format: ORD-YYYYMMDD-XXXX
 * - Exact single quantity ordered
 * - Separate stock from quantity
 * - Decrements stock in Items
 */
export async function createOrder(
  marketId: string,
  user: User,
  itemsToOrder: Array<{
    item: Item;
    quantity: number;
  }>,
  note?: string
): Promise<Order> {
  if (itemsToOrder.length === 0) {
    throw new Error('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
  }

  const market = cacheMarkets.find((m) => m.id === marketId);
  const marketName = market ? market.name : 'ตลาดทั่วไป';

  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const orderNumber = `ORD-${dateStr}-${(cacheOrders.length + 1).toString().padStart(4, '0')}`;

  const orderItems: OrderItem[] = itemsToOrder.map((ordered) => {
    // Find latest stock
    const currentItem = cacheItems.find((it) => it.id === ordered.item.id);
    const stockBefore = currentItem ? currentItem.stock : ordered.item.stock;

    return {
      id: `oit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      orderId,
      itemId: ordered.item.id,
      itemName: ordered.item.name,
      categoryName: ordered.item.categoryName || 'ทั่วไป',
      stockBefore,
      quantity: Number(ordered.quantity), // Exact single integer
      unit: ordered.item.unit,
    };
  });

  const order: Order = {
    id: orderId,
    orderNumber,
    marketId,
    marketName,
    userId: user.id,
    userName: user.name,
    items: orderItems,
    totalItems: orderItems.length,
    note: note || '',
    createdAt: now.toISOString(),
  };

  // Decrement stock in items
  cacheItems = cacheItems.map((it) => {
    const ordered = itemsToOrder.find((o) => o.item.id === it.id);
    if (ordered) {
      return {
        ...it,
        stock: Math.max(0, it.stock - ordered.quantity),
      };
    }
    return it;
  });
  saveLocal(KEY_ITEMS, cacheItems);

  cacheOrders.unshift(order);
  saveLocal(KEY_ORDERS, cacheOrders);

  // Sync to Google Sheets
  if (cacheSettings.spreadsheetId) {
    // 1. Append Order row
    const orderRow = [
      order.id,
      order.orderNumber,
      order.marketId,
      order.marketName,
      order.userId,
      order.userName,
      order.totalItems,
      order.createdAt,
      order.note || '',
    ];
    appendSheetRow(cacheSettings.spreadsheetId, 'Orders', orderRow).catch(console.error);

    // 2. Append OrderItems rows
    orderItems.forEach((item) => {
      const row = [
        item.id,
        item.orderId,
        item.itemId,
        item.itemName,
        item.categoryName,
        item.stockBefore,
        item.quantity,
        item.unit,
      ];
      appendSheetRow(cacheSettings.spreadsheetId!, 'OrderItems', row).catch(console.error);
    });

    // 3. Update Items stock
    const itemRows = cacheItems.map((it) => [
      it.id,
      it.name,
      it.categoryId,
      it.categoryName || '',
      it.stock,
      it.unit,
      it.createdAt,
    ]);
    overwriteSheetRows(cacheSettings.spreadsheetId, 'Items', itemRows).catch(console.error);
  }

  return order;
}
