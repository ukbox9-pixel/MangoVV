import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Sheet,
  ExternalLink,
  RefreshCw,
  PlusCircle,
  Database,
  CheckCircle2,
  AlertCircle,
  Save,
  Link,
  ShieldCheck,
  Store,
  Tag,
  Package,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { User, AppSettings } from '../types';
import {
  getSettings,
  saveSettings,
  syncFromGoogleSheets,
  pushAllToGoogleSheets,
  getMarkets,
  getCategories,
  getItems,
  getOrders,
  getUsers,
} from '../services/db';
import {
  createHppSpreadsheet,
  verifyAndInitSpreadsheet,
  SHEET_NAMES,
} from '../services/sheets';
import { googleSignIn, getAccessToken, logoutGoogle } from '../services/auth';

interface SettingsViewProps {
  currentUser: User;
  showToast: (type: 'success' | 'error', message: string) => void;
  onSettingsUpdated: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  showToast,
  onSettingsUpdated,
}) => {
  const [settings, setSettingsState] = useState<AppSettings>(getSettings());
  const [inputSpreadsheetId, setInputSpreadsheetId] = useState(
    settings.spreadsheetId || ''
  );
  const [isGoogleLoggedIn, setIsGoogleLoggedIn] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingId, setIsSavingId] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    markets: 0,
    categories: 0,
    items: 0,
    orders: 0,
    users: 0,
  });

  const loadStats = () => {
    setStats({
      markets: getMarkets().length,
      categories: getCategories().length,
      items: getItems().length,
      orders: getOrders(currentUser).length,
      users: getUsers().length,
    });
  };

  useEffect(() => {
    loadStats();
    getAccessToken().then((tok) => {
      setIsGoogleLoggedIn(!!tok);
    });
  }, [currentUser]);

  const handleGoogleConnect = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setIsGoogleLoggedIn(true);
        showToast('success', `✓ เข้าสู่ระบบ Google สำเร็จ (${result.user.email || ''})`);
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', 'เชื่อมต่อ Google ไม่สำเร็จ: ' + (err?.message || ''));
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await logoutGoogle();
      setIsGoogleLoggedIn(false);
      showToast('success', 'ออกจากระบบ Google สำเร็จ');
    } catch (err: any) {
      showToast('error', 'เกิดข้อผิดพลาดในการออกจากระบบ');
    }
  };

  // 1-Click Automatic Google Sheet Creation
  const handleAutoCreateSpreadsheet = async () => {
    if (!isGoogleLoggedIn) {
      showToast('error', 'กรุณาเชื่อมต่อ Google Account ด้านบนก่อนสร้าง Google Sheet');
      return;
    }

    try {
      setIsCreatingSheet(true);
      const { id, url } = await createHppSpreadsheet('Mango_Store_Database');

      const updatedSettings: AppSettings = {
        ...settings,
        spreadsheetId: id,
        spreadsheetName: 'Mango_Store_Database',
        spreadsheetUrl: url,
        lastSyncTime: new Date().toISOString(),
      };

      saveSettings(updatedSettings);
      setSettingsState(updatedSettings);
      setInputSpreadsheetId(id);

      // Push initial data
      await pushAllToGoogleSheets();

      showToast('success', '✓ สร้าง Google Sheets สำเร็จพร้อมสร้าง 10 แท็บตารางเรียบร้อยแล้ว');
      onSettingsUpdated();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'สร้าง Google Sheet ไม่สำเร็จ: ' + (err?.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Save manual Spreadsheet ID
  const handleSaveManualId = async () => {
    const cleanId = inputSpreadsheetId.trim();
    if (!cleanId) {
      showToast('error', 'กรุณาระบุ Spreadsheet ID');
      return;
    }

    try {
      setIsSavingId(true);
      if (isGoogleLoggedIn) {
        await verifyAndInitSpreadsheet(cleanId);
      }

      const updatedSettings: AppSettings = {
        ...settings,
        spreadsheetId: cleanId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}`,
      };

      saveSettings(updatedSettings);
      setSettingsState(updatedSettings);
      showToast('success', '✓ บันทึก Spreadsheet ID เรียบร้อยแล้ว');
      onSettingsUpdated();
    } catch (err: any) {
      showToast('error', 'ไม่สามารถเชื่อมต่อได้: ' + (err?.message || ''));
    } finally {
      setIsSavingId(false);
    }
  };

  // Manual Synchronize button
  const handleManualSync = async () => {
    if (!settings.spreadsheetId) {
      showToast('error', 'ยังไม่ได้ระบุ Google Spreadsheet ID');
      return;
    }

    if (!isGoogleLoggedIn) {
      showToast('error', 'กรุณาเชื่อมต่อ Google Account ก่อนทำการซิงค์');
      return;
    }

    try {
      setIsSyncing(true);
      const res = await syncFromGoogleSheets();
      if (res.success) {
        showToast('success', '✓ ' + res.message);
        loadStats();
        onSettingsUpdated();
      } else {
        showToast('error', '⚠ ' + res.message);
      }
    } catch (err: any) {
      showToast('error', 'เกิดข้อผิดพลาด: ' + (err?.message || ''));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-emerald-600" />
          <span>การตั้งค่าระบบ (System Settings)</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          จัดการฐานข้อมูล Google Sheets บัญชี Google และการซิงค์ข้อมูล
        </p>
      </div>

      {/* 1. Google Account Connection Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                การเชื่อมต่อ Google Workspace
              </h3>
              <p className="text-xs text-slate-500">
                {isGoogleLoggedIn
                  ? 'เชื่อมต่อแล้ว พร้อมอ่านและเขียนข้อมูลลง Google Sheets'
                  : 'เชื่อมต่อบัญชี Google ของคุณเพื่อบันทึกและจัดการฐานข้อมูล'}
              </p>
            </div>
          </div>

          <div>
            {isGoogleLoggedIn ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  เชื่อมต่อแล้ว
                </span>
                <button
                  type="button"
                  onClick={handleGoogleDisconnect}
                  className="text-xs text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  ยกเลิกการเชื่อมต่อ
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleConnect}
                className="flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:scale-98 shadow-xs transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Google Sheets Database Configuration */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <Sheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              ฐานข้อมูลหลัก Google Sheets
            </h3>
            <p className="text-xs text-slate-500">
              ตาราง 10 แผ่นงาน: Markets, Categories, CategoryMarkets, Items, Users, UserMarkets, Orders, OrderItems, Settings, History
            </p>
          </div>
        </div>

        {/* 1-Click Auto Creation */}
        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>สร้าง Google Sheet อัตโนมัติ (แนะนำ)</span>
            </div>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-400 mt-0.5">
              ระบบจะสร้างไฟล์ Google Sheets ใน Google Drive ของคุณ พร้อมตั้งชื่อแท็บทั้ง 10 แท็บและหัวคอลัมน์อัตโนมัติ
            </p>
          </div>

          <button
            type="button"
            onClick={handleAutoCreateSpreadsheet}
            disabled={isCreatingSheet}
            className="py-2 px-4 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-98 transition-all whitespace-nowrap self-start sm:self-auto disabled:opacity-50"
          >
            {isCreatingSheet ? 'กำลังสร้าง Sheet...' : 'สร้าง Sheet ทันที'}
          </button>
        </div>

        {/* Manual Spreadsheet ID Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            หรือระบุ Google Spreadsheet ID เอง:
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={inputSpreadsheetId}
              onChange={(e) => setInputSpreadsheetId(e.target.value)}
              placeholder="เช่น 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleSaveManualId}
              disabled={isSavingId}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-white active:scale-98 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingId ? 'กำลังตรวจสอบ...' : 'บันทึก ID'}</span>
            </button>
          </div>
        </div>

        {/* Current Linked Sheet Info */}
        {settings.spreadsheetId && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-slate-500">Spreadsheet ID: </span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {settings.spreadsheetId}
                </span>
              </div>

              {settings.spreadsheetUrl && (
                <a
                  href={settings.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                >
                  <span>เปิดดูใน Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {settings.lastSyncTime && (
              <div className="text-[11px] text-slate-400">
                ซิงค์ข้อมูลล่าสุดเมื่อ: {new Date(settings.lastSyncTime).toLocaleString('th-TH')}
              </div>
            )}

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-98 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'กำลังซิงค์ข้อมูล...' : 'ซิงค์ข้อมูลกับ Google Sheets ทันที'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Database Statistics Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          สถิติข้อมูลในระบบ (Database Stats)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Store className="w-3.5 h-3.5 text-emerald-600" />
              <span>ตลาด</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
              {stats.markets}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>หมวดหมู่</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
              {stats.categories}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span>สินค้า</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
              {stats.items}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
              <span>คำสั่งซื้อ</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
              {stats.orders}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>ผู้ใช้งาน</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">
              {stats.users}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
