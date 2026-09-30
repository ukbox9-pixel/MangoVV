import React, { useState, useEffect } from 'react';
import { User, Order, AppSettings } from './types';
import {
  getSessionUser,
  clearSessionUser,
  initAuth,
  getAccessToken,
} from './services/auth';
import { getSettings, initLocalData } from './services/db';
import { PinLogin } from './components/PinLogin';
import { Navbar, NavTab } from './components/Navbar';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ReceiptModal } from './views/ReceiptModal';
import { OrderView } from './views/OrderView';
import { HistoryView } from './views/HistoryView';
import { ItemsView } from './views/ItemsView';
import { MarketsView } from './views/MarketsView';
import { UsersView } from './views/UsersView';
import { SettingsView } from './views/SettingsView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('order');
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Newly created or selected order for modal view
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Initialize DB and Auth state on mount
  useEffect(() => {
    initLocalData();
    const storedUser = getSessionUser();
    if (storedUser) {
      setCurrentUser(storedUser);
    }

    // Check Google Auth state
    initAuth(
      () => setIsGoogleConnected(true),
      () => setIsGoogleConnected(false)
    );

    getAccessToken().then((token) => {
      if (token) setIsGoogleConnected(true);
    });
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('order');
  };

  const handleLogout = () => {
    clearSessionUser();
    setCurrentUser(null);
    showToast('success', 'ออกจากระบบเรียบร้อยแล้ว');
  };

  const handleOrderCreated = (order: Order) => {
    setActiveReceiptOrder(order);
    setIsReceiptModalOpen(true);
  };

  const handleSettingsUpdated = () => {
    setSettings(getSettings());
  };

  // If not logged in, show fast PIN login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100">
        <PinLogin onLoginSuccess={handleLoginSuccess} showToast={showToast} />
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          // If non-admin tries to access admin tabs, fallback to order
          if (currentUser.role !== 1 && ['items', 'markets', 'users'].includes(tab)) {
            setActiveTab('order');
          } else {
            setActiveTab(tab);
          }
        }}
        onLogout={handleLogout}
        settings={settings}
        isGoogleConnected={isGoogleConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {activeTab === 'order' && (
          <OrderView
            currentUser={currentUser}
            showToast={showToast}
            onOrderCreated={handleOrderCreated}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView currentUser={currentUser} showToast={showToast} />
        )}

        {activeTab === 'items' && currentUser.role === 1 && (
          <ItemsView showToast={showToast} />
        )}

        {activeTab === 'markets' && currentUser.role === 1 && (
          <MarketsView showToast={showToast} />
        )}

        {activeTab === 'users' && currentUser.role === 1 && (
          <UsersView currentUser={currentUser} showToast={showToast} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            currentUser={currentUser}
            showToast={showToast}
            onSettingsUpdated={handleSettingsUpdated}
          />
        )}
      </main>

      {/* Receipt Modal */}
      <ReceiptModal
        order={activeReceiptOrder}
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        showToast={showToast}
      />

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
