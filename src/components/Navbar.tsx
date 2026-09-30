import React from 'react';
import {
  ShoppingCart,
  ClipboardList,
  Package,
  Store,
  Users,
  Settings,
  LogOut,
  Sheet,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { User, AppSettings } from '../types';

export type NavTab = 'order' | 'history' | 'items' | 'markets' | 'users' | 'settings';

interface NavbarProps {
  currentUser: User;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onLogout: () => void;
  settings: AppSettings;
  isGoogleConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  onSelectTab,
  onLogout,
  settings,
  isGoogleConnected,
}) => {
  const isAdmin = currentUser.role === 1;

  const navItems = [
    { id: 'order' as NavTab, label: 'สั่งซื้อ', icon: ShoppingCart },
    { id: 'history' as NavTab, label: 'ประวัติ', icon: ClipboardList },
    ...(isAdmin
      ? [
          { id: 'items' as NavTab, label: 'จัดการสินค้า', icon: Package },
          { id: 'markets' as NavTab, label: 'ตลาด/หมวดหมู่', icon: Store },
          { id: 'users' as NavTab, label: 'ผู้ใช้งาน', icon: Users },
        ]
      : []),
    { id: 'settings' as NavTab, label: 'ตั้งค่า', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand & User Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-white font-extrabold text-lg px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1">
                <span>Mango</span>
                <span>🥭</span>
              </span>
              <span className="hidden sm:inline font-semibold text-slate-800 dark:text-white text-base">
                ระบบจัดการสินค้า
              </span>
            </div>

            {/* Sheets Status Indicator */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                settings.spreadsheetId
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              <Sheet className="w-3.5 h-3.5" />
              <span>{settings.spreadsheetId ? 'Google Sheets เชื่อมต่อแล้ว' : 'โหมดแคช (รอเชื่อมต่อ)'}</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-right">
              <div className="text-xs hidden sm:block">
                <div className="font-medium text-slate-900 dark:text-white leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                  {isAdmin ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งาน'}
                </div>
              </div>
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs ${
                  isAdmin ? 'bg-amber-600' : 'bg-emerald-600'
                }`}
                title={currentUser.name}
              >
                {currentUser.name.charAt(0) || 'U'}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
              title="ออกจากระบบ"
              aria-label="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Navigation Tabs */}
        <div className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto no-scrollbar pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
