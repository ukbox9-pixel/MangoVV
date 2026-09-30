export interface Market {
  id: string;
  name: string;
  description?: string;
  categoryIds: string[];
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface Item {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  stock: number;
  unit: string;
  createdAt: string;
}

export type Role = 0 | 1; // 0 = Standard User, 1 = Admin

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  name: string;
  pin: string; // Stored as formatted 4-digit string, e.g. "0000"
  role: Role;
  status: UserStatus;
  marketIds?: string[]; // Allowed markets, empty/undefined = all
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  itemId: string;
  itemName: string;
  categoryName: string;
  stockBefore: number;
  quantity: number; // Exact single quantity ordered
  unit: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  marketId: string;
  marketName: string;
  userId: string;
  userName: string;
  items: OrderItem[];
  totalItems: number;
  note?: string;
  createdAt: string;
}

export interface HistoryLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  userId: string;
  userName: string;
}

export interface AppSettings {
  spreadsheetId?: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  lastSyncTime?: string;
}
