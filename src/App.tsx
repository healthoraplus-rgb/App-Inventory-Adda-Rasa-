import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  NavigationTab,
  Product,
  Supplier,
  Transaction,
  User,
  ReportFilter,
  GoogleSheetsSyncState,
} from './types';
import {
  INITIAL_PRODUCTS,
  INITIAL_SUPPLIERS,
  INITIAL_TRANSACTIONS,
  INITIAL_USERS,
  INITIAL_USER,
} from './data/initialData';

// Google Sheets and Firebase Auth Services
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  getAccessToken,
  setAccessToken,
  getSavedWebAppUrl,
  saveWebAppUrl,
} from './services/googleAuth';
import {
  DEFAULT_SPREADSHEET_ID,
  syncAllToSpreadsheet,
  syncAllToAppsScript,
  fetchAllFromAppsScript,
  fetchAllFromSpreadsheet,
  getSpreadsheetDetails,
} from './services/googleSheetsService';

// Component Views
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { LoginScreen } from './components/LoginScreen';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { StockView } from './components/StockView';
import { TransactionsView } from './components/TransactionsView';
import { SuppliersView } from './components/SuppliersView';
import { ReportView } from './components/ReportView';
import { SettingsView } from './components/SettingsView';
import { exportProductsToXLSX } from './utils/excelParser';
import {
  calculateInventoryMetrics,
  getProductStockSummary,
  getRealStock,
} from './utils/stockCalculator';

// Modals
import { AddProductModal } from './components/AddProductModal';
import { EditProductModal } from './components/EditProductModal';
import { ImportExportModal } from './components/ImportExportModal';
import { ReportFilterModal } from './components/ReportFilterModal';
import { RequestAccessModal } from './components/RequestAccessModal';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { AddSupplierModal } from './components/AddSupplierModal';
import { EditSupplierModal } from './components/EditSupplierModal';
import { CriticalStockMessageModal } from './components/CriticalStockMessageModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { SalesExportModal } from './components/SalesExportModal';

export const App: React.FC = () => {
  // Authentication & Registered Users State (Login screen as initial view)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('addarasa_users');
      if (saved) {
        const parsed: User[] = JSON.parse(saved);
        // Remove legacy dummy accounts if found
        const isDummy = parsed.some((u) => u.name === 'Jane Doe' || u.name === 'Ahmad Fauzi');
        if (!isDummy && parsed.length > 0) {
          return parsed;
        }
      }
      return INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  const [user, setUser] = useState<User>(() => users[0] || INITIAL_USER);

  // Persist users to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('addarasa_users', JSON.stringify(users));
    } catch {
      // ignore
    }
  }, [users]);

  // Google Sheets Sync State
  const [syncState, setSyncState] = useState<GoogleSheetsSyncState>(() => {
    try {
      const saved = localStorage.getItem('addarasa_sheets_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          isConnected: Boolean(parsed.isConnected && (parsed.webAppUrl || localStorage.getItem('addarasa_google_access_token'))),
          syncMethod: parsed.syncMethod || (parsed.webAppUrl ? 'webapp' : 'popup'),
          webAppUrl: parsed.webAppUrl || getSavedWebAppUrl() || undefined,
          googleUserEmail: parsed.googleUserEmail || localStorage.getItem('addarasa_google_user_email') || undefined,
          spreadsheetId: parsed.spreadsheetId || DEFAULT_SPREADSHEET_ID,
          spreadsheetTitle: parsed.spreadsheetTitle || 'ADDA RASA Inventory Master Sheet',
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${parsed.spreadsheetId || DEFAULT_SPREADSHEET_ID}/edit`,
          autoSync: parsed.autoSync ?? true,
          isSyncing: false,
          lastSyncedAt: parsed.lastSyncedAt || undefined,
        };
      }
    } catch {
      // ignore
    }
    const savedWebApp = getSavedWebAppUrl();
    return {
      isConnected: Boolean(savedWebApp),
      syncMethod: savedWebApp ? 'webapp' : 'popup',
      webAppUrl: savedWebApp || undefined,
      googleUserEmail: savedWebApp ? 'Google Apps Script Web App' : undefined,
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      spreadsheetTitle: 'ADDA RASA Inventory Master Sheet',
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit`,
      autoSync: true,
      isSyncing: false,
    };
  });

  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);

  // Save sync config preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'addarasa_sheets_config',
        JSON.stringify({
          isConnected: syncState.isConnected,
          syncMethod: syncState.syncMethod,
          webAppUrl: syncState.webAppUrl,
          googleUserEmail: syncState.googleUserEmail,
          spreadsheetId: syncState.spreadsheetId,
          spreadsheetTitle: syncState.spreadsheetTitle,
          autoSync: syncState.autoSync,
          lastSyncedAt: syncState.lastSyncedAt,
        })
      );
    } catch {
      // ignore
    }
  }, [
    syncState.isConnected,
    syncState.syncMethod,
    syncState.webAppUrl,
    syncState.googleUserEmail,
    syncState.spreadsheetId,
    syncState.spreadsheetTitle,
    syncState.autoSync,
    syncState.lastSyncedAt,
  ]);

  // Initialize Auth State Listener for Google Account (OAuth / GSI)
  useEffect(() => {
    const unsubscribe = initAuth(
      (firebaseUser, token) => {
        setSyncState((prev) => {
          if (prev.syncMethod === 'webapp' && prev.isConnected) return prev;
          return {
            ...prev,
            isConnected: true,
            syncMethod: 'popup',
            googleUserEmail: firebaseUser.email || undefined,
            userEmail: firebaseUser.email || undefined,
            errorMessage: undefined,
          };
        });
      },
      () => {
        setSyncState((prev) => {
          if (prev.syncMethod === 'webapp' && prev.isConnected) return prev;
          return {
            ...prev,
            isConnected: false,
            userEmail: undefined,
          };
        });
      }
    );
    return () => unsubscribe();
  }, []);

  // Navigation & Search
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  // Domain Datasets (Initialized with clean production dataset)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('addarasa_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Purge legacy dummy items if found
          const isLegacyDummy = parsed.some(
            (p) => p.name === 'Ayam Goreng Lengkuas' || p.name === 'Ayam Bakar Madu'
          );
          if (!isLegacyDummy) return parsed;
        }
      }
      return INITIAL_PRODUCTS;
    } catch {
      return INITIAL_PRODUCTS;
    }
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem('addarasa_suppliers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const isLegacyDummy = parsed.some(
            (s) => s.name === 'PT Sumber Pangan Utama' || s.name === 'CV Berkah Bumbu Nusantara'
          );
          if (!isLegacyDummy) return parsed;
        }
      }
      return INITIAL_SUPPLIERS;
    } catch {
      return INITIAL_SUPPLIERS;
    }
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('addarasa_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const isLegacyDummy = parsed.some(
            (t) => t.code === 'TRX-928101' || t.productName === 'Ayam Goreng Lengkuas'
          );
          if (!isLegacyDummy) return parsed;
        }
      }
      return INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  });

  // Persist domain datasets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('addarasa_products', JSON.stringify(products));
    } catch {
      // ignore
    }
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem('addarasa_suppliers', JSON.stringify(suppliers));
    } catch {
      // ignore
    }
  }, [suppliers]);

  useEffect(() => {
    try {
      localStorage.setItem('addarasa_transactions', JSON.stringify(transactions));
    } catch {
      // ignore
    }
  }, [transactions]);

  // Initial background pull from Google Apps Script Web App
  useEffect(() => {
    const webAppUrl = syncState.webAppUrl || getSavedWebAppUrl();
    if (webAppUrl && webAppUrl.startsWith('https://script.google.com/')) {
      fetchAllFromAppsScript(webAppUrl)
        .then((remote) => {
          if (remote.products && remote.products.length > 0) {
            setProducts(remote.products);
          }
          if (remote.suppliers && remote.suppliers.length > 0) {
            setSuppliers(remote.suppliers);
          }
          if (remote.transactions && remote.transactions.length > 0) {
            setTransactions(remote.transactions);
          }
          if (remote.users && remote.users.length > 0) {
            setUsers(remote.users);
          }
          setSyncState((prev) => ({
            ...prev,
            isConnected: true,
            syncMethod: 'webapp',
            webAppUrl,
            googleUserEmail: 'Google Apps Script (Aktif Terhubung)',
            lastSyncedAt: new Date().toLocaleString('id-ID'),
          }));
        })
        .catch((e) => {
          console.warn('Initial sync pull attempt:', e);
        });
    }
  }, []);

  // Google Sheets Action Handlers
  const handleConnectGoogle = async () => {
    try {
      setSyncState((prev) => ({ ...prev, isSyncing: true, errorMessage: undefined }));
      const authResult = await googleSignIn();
      if (!authResult) {
        throw new Error('Autentikasi Google dibatalkan atau tidak berhasil.');
      }

      setSyncState((prev) => ({
        ...prev,
        isConnected: true,
        syncMethod: 'popup',
        googleUserEmail: authResult.user.email || undefined,
        userEmail: authResult.user.email || undefined,
        isSyncing: false,
      }));

      // After connecting, push current data or pull data if local is empty
      const token = authResult.accessToken;
      if (products.length > 0 || suppliers.length > 0 || transactions.length > 0) {
        await syncAllToSpreadsheet(token, products, suppliers, transactions, syncState.spreadsheetId);
        setSyncState((prev) => ({
          ...prev,
          lastSyncedAt: new Date().toLocaleString('id-ID'),
        }));
      } else {
        // Try pulling from spreadsheet if spreadsheet already has data
        try {
          const remote = await fetchAllFromSpreadsheet(token, syncState.spreadsheetId);
          if (remote.products.length > 0) setProducts(remote.products);
          if (remote.suppliers.length > 0) setSuppliers(remote.suppliers);
          if (remote.transactions.length > 0) setTransactions(remote.transactions);
          setSyncState((prev) => ({
            ...prev,
            lastSyncedAt: new Date().toLocaleString('id-ID'),
          }));
        } catch {
          // Initialize empty sheets with headers
          await syncAllToSpreadsheet(token, [], [], [], syncState.spreadsheetId);
        }
      }
    } catch (err: any) {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        errorMessage: err?.message || 'Gagal menghubungkan Google Sheets',
      }));
      throw err;
    }
  };

  const handleConnectWebApp = async (url: string) => {
    if (!url || !url.startsWith('https://script.google.com/')) {
      throw new Error('URL Web App Google Apps Script tidak valid. Harus diawali https://script.google.com/...');
    }

    setSyncState((prev) => ({ ...prev, isSyncing: true, errorMessage: undefined }));
    try {
      saveWebAppUrl(url);

      // 1. Fetch live data from Google Spreadsheet
      const remote = await fetchAllFromAppsScript(url);

      if (remote.products && remote.products.length > 0) {
        setProducts(remote.products);
      }
      if (remote.suppliers && remote.suppliers.length > 0) {
        setSuppliers(remote.suppliers);
      }
      if (remote.transactions && remote.transactions.length > 0) {
        setTransactions(remote.transactions);
      }
      if (remote.users && remote.users.length > 0) {
        setUsers(remote.users);
      }

      // If remote was empty, seed with current local state
      if ((!remote.products || remote.products.length === 0) && products.length > 0) {
        await syncAllToAppsScript(url, products, suppliers, transactions, users);
      }

      setSyncState((prev) => ({
        ...prev,
        isConnected: true,
        syncMethod: 'webapp',
        webAppUrl: url,
        googleUserEmail: 'Google Apps Script (Aktif Terhubung)',
        isSyncing: false,
        lastSyncedAt: new Date().toLocaleString('id-ID'),
      }));
    } catch (err: any) {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        errorMessage: err?.message || 'Gagal menghubungkan Google Apps Script Web App',
      }));
      throw err;
    }
  };

  const handleConnectManualToken = async (token: string) => {
    if (!token || token.trim().length < 10) {
      throw new Error('Format token OAuth tidak valid.');
    }

    setSyncState((prev) => ({ ...prev, isSyncing: true, errorMessage: undefined }));
    try {
      setAccessToken(token.trim());
      await syncAllToSpreadsheet(token.trim(), products, suppliers, transactions, syncState.spreadsheetId);

      setSyncState((prev) => ({
        ...prev,
        isConnected: true,
        syncMethod: 'token',
        googleUserEmail: 'Token OAuth Manual',
        isSyncing: false,
        lastSyncedAt: new Date().toLocaleString('id-ID'),
      }));
    } catch (err: any) {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        errorMessage: err?.message || 'Token tidak valid atau tidak memiliki izin Google Sheets',
      }));
      throw err;
    }
  };

  const handleUpdateSpreadsheetId = (newId: string) => {
    if (!newId) return;
    setSyncState((prev) => ({
      ...prev,
      spreadsheetId: newId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${newId}/edit`,
    }));
  };

  const handleDisconnectGoogle = async () => {
    await logoutGoogle();
    setAccessToken(null);
    saveWebAppUrl('');
    setSyncState((prev) => ({
      ...prev,
      isConnected: false,
      userEmail: undefined,
      googleUserEmail: undefined,
      webAppUrl: undefined,
      errorMessage: undefined,
    }));
  };

  const handleSyncNow = async (direction: 'push' | 'pull' | 'both') => {
    setSyncState((prev) => ({ ...prev, isSyncing: true, errorMessage: undefined }));

    try {
      // 1. If using Google Apps Script Web App mode
      if (syncState.syncMethod === 'webapp' && syncState.webAppUrl) {
        if (direction === 'pull') {
          const remote = await fetchAllFromAppsScript(syncState.webAppUrl);
          if (remote.products && remote.products.length > 0) setProducts(remote.products);
          if (remote.suppliers && remote.suppliers.length > 0) setSuppliers(remote.suppliers);
          if (remote.transactions && remote.transactions.length > 0) setTransactions(remote.transactions);
          if (remote.users && remote.users.length > 0) setUsers(remote.users);
        } else if (direction === 'push') {
          await syncAllToAppsScript(syncState.webAppUrl, products, suppliers, transactions, users);
        } else {
          // both
          const remote = await fetchAllFromAppsScript(syncState.webAppUrl);
          if (remote.products && remote.products.length > 0) {
            setProducts(remote.products);
            if (remote.suppliers && remote.suppliers.length > 0) setSuppliers(remote.suppliers);
            if (remote.transactions && remote.transactions.length > 0) setTransactions(remote.transactions);
            if (remote.users && remote.users.length > 0) setUsers(remote.users);
          } else {
            await syncAllToAppsScript(syncState.webAppUrl, products, suppliers, transactions, users);
          }
        }

        setSyncState((prev) => ({
          ...prev,
          isConnected: true,
          isSyncing: false,
          lastSyncedAt: new Date().toLocaleString('id-ID'),
        }));
        return;
      }

      // 2. If using OAuth / Token mode
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Silakan hubungkan akun Google atau Web App terlebih dahulu.');
      }

      if (direction === 'pull') {
        const remote = await fetchAllFromSpreadsheet(token, syncState.spreadsheetId);
        if (remote.products && remote.products.length > 0) setProducts(remote.products);
        if (remote.suppliers && remote.suppliers.length > 0) setSuppliers(remote.suppliers);
        if (remote.transactions && remote.transactions.length > 0) setTransactions(remote.transactions);
      } else {
        await syncAllToSpreadsheet(token, products, suppliers, transactions, syncState.spreadsheetId);
      }

      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncedAt: new Date().toLocaleString('id-ID'),
      }));
    } catch (err: any) {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        errorMessage: err?.message || 'Gagal menyinkronkan data dengan Google Sheets',
      }));
      throw err;
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setSyncState((prev) => ({ ...prev, autoSync: enabled }));
  };

  // Real-time automatic background push when state updates if connected & autoSync
  const isInitialMount = useRef(true);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerRealtimeSheetPush = useCallback(
    (currentProducts: Product[], currentSuppliers: Supplier[], currentTransactions: Transaction[]) => {
      if (!syncState.isConnected || !syncState.autoSync) return;

      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          if (syncState.syncMethod === 'webapp' && syncState.webAppUrl) {
            setSyncState((prev) => ({ ...prev, isSyncing: true }));
            await syncAllToAppsScript(syncState.webAppUrl, currentProducts, currentSuppliers, currentTransactions);
            setSyncState((prev) => ({
              ...prev,
              isSyncing: false,
              lastSyncedAt: new Date().toLocaleString('id-ID'),
            }));
            return;
          }

          const token = await getAccessToken();
          if (!token) return;

          setSyncState((prev) => ({ ...prev, isSyncing: true }));
          await syncAllToSpreadsheet(
            token,
            currentProducts,
            currentSuppliers,
            currentTransactions,
            syncState.spreadsheetId
          );
          setSyncState((prev) => ({
            ...prev,
            isSyncing: false,
            lastSyncedAt: new Date().toLocaleString('id-ID'),
          }));
        } catch (err: any) {
          console.warn('Auto sync warning:', err);
          setSyncState((prev) => ({ ...prev, isSyncing: false }));
        }
      }, 1200);
    },
    [syncState.isConnected, syncState.autoSync, syncState.syncMethod, syncState.webAppUrl, syncState.spreadsheetId]
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    triggerRealtimeSheetPush(products, suppliers, transactions);
  }, [products, suppliers, transactions, triggerRealtimeSheetPush]);

  // Report Filter State
  const [reportFilter, setReportFilter] = useState<ReportFilter>({
    startDate: '01-08-2026',
    endDate: '31-08-2026',
    month: 'Agustus 2026',
    supplier: 'Semua Supplier',
    category: 'Semua Kategori',
  });

  // Modal Visibility States
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReportFilterOpen, setIsReportFilterOpen] = useState(false);
  const [isSalesExportOpen, setIsSalesExportOpen] = useState(false);
  const [isRequestAccessOpen, setIsRequestAccessOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [transactionEntryType, setTransactionEntryType] = useState<'IN' | 'OUT' | 'RETUR_OUT'>('IN');
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Critical Stock Messaging Modal State
  const [isCriticalMessageOpen, setIsCriticalMessageOpen] = useState(false);
  const [criticalMessageSupplier, setCriticalMessageSupplier] = useState<string | undefined>(undefined);

  // Real-time Critical Stock Banner Alert
  const [activeCriticalAlert, setActiveCriticalAlert] = useState<{
    productName: string;
    remainingStock: number;
    minStock: number;
    supplier: string;
  } | null>(null);

  // Notifications count (low & out of stock items based on accurate real stock)
  const lowStockCount = products.filter((p) => {
    const summary = getProductStockSummary(p, transactions);
    return summary.health === 'Habis' || summary.health === 'Menipis';
  }).length;

  // Authentication Handlers
  const handleLogin = ({ username, password }: { username: string; password?: string }) => {
    const found = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase().trim()
    );

    if (!found) {
      // Fallback convenience: allow quick demo admin if username is admin
      if (username.toLowerCase() === 'admin') {
        setUser(INITIAL_USER);
        setIsLoggedIn(true);
        return { success: true };
      }
      return { success: false, message: 'Username tidak ditemukan dalam sistem.' };
    }

    if (found.status === 'Nonaktif') {
      return { success: false, message: 'Akun Anda telah dinonaktifkan. Hubungi administrator.' };
    }

    if (found.password && password && found.password !== password) {
      return { success: false, message: 'Kata sandi tidak sesuai.' };
    }

    // Update lastLogin
    const updatedUser = {
      ...found,
      lastLogin: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
    };

    setUsers((prev) =>
      prev.map((u) => (u.username === found.username ? updatedUser : u))
    );
    setUser(updatedUser);
    setIsLoggedIn(true);
    return { success: true };
  };

  const handleRegister = (newUser: User) => {
    const existing = users.find(
      (u) => u.username.toLowerCase() === newUser.username.toLowerCase()
    );
    if (existing) {
      return { success: false, message: 'Username ini sudah terdaftar. Silakan gunakan username lain.' };
    }

    const createdUser: User = {
      ...newUser,
      id: `usr-${Date.now()}`,
      status: 'Aktif',
      createdAt: new Date().toISOString().split('T')[0],
      lastLogin: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
    };

    setUsers((prev) => [createdUser, ...prev]);
    setUser(createdUser);
    setIsLoggedIn(true);
    return { success: true };
  };

  // User Management in Settings
  const handleAddUser = (newUserData: Omit<User, 'id'> | User) => {
    const created: User = {
      ...newUserData,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
      status: newUserData.status || 'Aktif',
    };
    setUsers((prev) => [created, ...prev]);
  };

  const handleEditUser = (updatedUser: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id || u.username === updatedUser.username ? updatedUser : u))
    );
    if (updatedUser.username === user.username) {
      setUser(updatedUser);
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId && u.username !== userId));
  };

  const handleToggleUserStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId || u.username === userId) {
          const newStatus = u.status === 'Nonaktif' ? 'Aktif' : 'Nonaktif';
          return { ...u, status: newStatus };
        }
        return u;
      })
    );
  };

  const handleUpdateCurrentProfile = (updated: Partial<User>) => {
    const updatedFull = { ...user, ...updated };
    setUser(updatedFull);
    setUsers((prev) =>
      prev.map((u) => (u.username === user.username ? { ...u, ...updated } : u))
    );
  };

  // Open the automated supplier message modal
  const handleOpenCriticalMessageModal = (supplierName?: string) => {
    setCriticalMessageSupplier(supplierName);
    setIsCriticalMessageOpen(true);
  };

  // Handlers for Data Mutations
  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    const created: Product = {
      ...newProd,
      id: String(Date.now()),
    };
    setProducts((prev) => [created, ...prev]);
  };

  const handleUpdateProduct = (updated: Product) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === updated.id || (p.code && p.code === updated.code)) {
          return updated;
        }
        return p;
      })
    );
    setIsEditProductOpen(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = (product: Product) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus produk "${product.name}" (${product.code})?`)) {
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    }
  };

  // Product Reset Handlers
  const handleClearAllProducts = () => {
    setProducts([]);
  };

  const handleResetDefaultProducts = () => {
    setProducts(INITIAL_PRODUCTS);
  };

  // Stock Reset / Deletion Handlers
  const handleResetStockToZero = () => {
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        initialStock: 0,
        currentStock: 0,
        healthStatus: 'Habis',
        lastUpdated: new Date().toISOString().split('T')[0],
      }))
    );
  };

  const handleClearStockAndTransactions = () => {
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        initialStock: 0,
        currentStock: 0,
        healthStatus: 'Habis',
        lastUpdated: new Date().toISOString().split('T')[0],
      }))
    );
    setTransactions([]);
  };

  const handleUpdateStock = (productId: string, newStock: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const healthStatus =
            newStock <= 0 ? 'Habis' : newStock <= p.minStock ? 'Menipis' : 'Aman';
          
          if (newStock <= p.minStock) {
            setActiveCriticalAlert({
              productName: p.name,
              remainingStock: newStock,
              minStock: p.minStock,
              supplier: p.supplier,
            });
          }

          return {
            ...p,
            currentStock: newStock,
            healthStatus,
            lastUpdated: new Date().toISOString().split('T')[0],
          };
        }
        return p;
      })
    );
  };

  const handleSyncStockFromTransactions = () => {
    setProducts((prev) =>
      prev.map((p) => {
        const summary = getProductStockSummary(p, transactions);
        return {
          ...p,
          currentStock: summary.currentStock,
          healthStatus: summary.health,
          lastUpdated: new Date().toISOString().split('T')[0],
        };
      })
    );
  };

  const handleAddTransaction = (newTrx: Omit<Transaction, 'id'>) => {
    const created: Transaction = {
      ...newTrx,
      id: `trx-${Date.now()}`,
    };
    setTransactions((prev) => [created, ...prev]);

    // Also update product stock and check if critical threshold reached
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === newTrx.productId || p.code === newTrx.productCode) {
          const current = p.currentStock ?? p.initialStock;
          const isIncoming = newTrx.type === 'IN' || newTrx.type === 'RETUR_IN';
          const updatedStock = isIncoming
            ? current + newTrx.quantity
            : Math.max(0, current - newTrx.quantity);
          const healthStatus =
            updatedStock <= 0
              ? 'Habis'
              : updatedStock <= p.minStock
              ? 'Menipis'
              : 'Aman';

          // If stock becomes critical, trigger alert toast
          if (updatedStock <= p.minStock) {
            setActiveCriticalAlert({
              productName: p.name,
              remainingStock: updatedStock,
              minStock: p.minStock,
              supplier: p.supplier,
            });
          }

          return {
            ...p,
            currentStock: updatedStock,
            healthStatus,
            lastUpdated: new Date().toISOString().split('T')[0],
          };
        }
        return p;
      })
    );
  };

  // Supplier CRUD Handlers
  const handleAddSupplier = (newSup: Omit<Supplier, 'id'>) => {
    const created: Supplier = {
      ...newSup,
      id: `sup-${Date.now()}`,
    };
    setSuppliers((prev) => [created, ...prev]);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsEditSupplierOpen(true);
  };

  const handleUpdateSupplier = (updated: Supplier) => {
    setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setIsEditSupplierOpen(false);
    setEditingSupplier(null);
  };

  const handleDeleteSupplier = (supplierId: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
  };

  const handleToggleSupplierStatus = (supplier: Supplier) => {
    const newStatus = supplier.status === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? { ...s, status: newStatus } : s))
    );
  };

  const handleImportProducts = (imported: Omit<Product, 'id'>[]) => {
    const createdList: Product[] = imported.map((item, idx) => ({
      ...item,
      id: `imported-${Date.now()}-${idx}`,
    }));

    // Auto-sync supplier: If imported products have supplier names that do not exist yet in suppliers list,
    // automatically add them as new official suppliers
    const existingSupplierNames = new Set(
      suppliers.map((s) => s.name.trim().toLowerCase())
    );

    const newSuppliersToAdd: Supplier[] = [];

    imported.forEach((item) => {
      const supName = (item.supplier || '').trim();
      if (
        supName &&
        supName.toLowerCase() !== 'umum' &&
        !existingSupplierNames.has(supName.toLowerCase())
      ) {
        existingSupplierNames.add(supName.toLowerCase());
        const supIndex = suppliers.length + newSuppliersToAdd.length + 1;
        const codeNum = String(supIndex).padStart(3, '0');
        newSuppliersToAdd.push({
          id: `sup-${Date.now()}-${newSuppliersToAdd.length}`,
          code: `SUP-${codeNum}`,
          name: supName,
          contactPerson: 'PIC Supplier',
          phone: '+62 812-0000-0000',
          email: `${supName.toLowerCase().replace(/[^a-z0-9]/g, '')}@supplier.com`,
          address: 'Lokasi Distributor / Pabrik',
          productCount: 1,
          distributionPercentage: 0,
          status: 'Aktif',
        });
      }
    });

    if (newSuppliersToAdd.length > 0) {
      setSuppliers((prev) => [...prev, ...newSuppliersToAdd]);
    }

    setProducts((prev) => [...createdList, ...prev]);
  };

  const handleExportProductsExcel = () => {
    if (products.length === 0) {
      alert('Tidak ada data produk untuk diekspor.');
      return;
    }
    exportProductsToXLSX(products);
  };

  const handleExportReportExcel = () => {
    const headers = 'Kode,Nama Produk,Kategori,Supplier,Stok Akhir,Status Stok\n';
    const rows = products
      .filter((p) => {
        if (
          reportFilter.supplier &&
          reportFilter.supplier !== 'Semua Supplier' &&
          p.supplier !== reportFilter.supplier
        ) {
          return false;
        }
        return true;
      })
      .map((p) => {
        const stock = p.currentStock ?? p.initialStock;
        const status = stock <= 0 ? 'Habis' : stock <= p.minStock ? 'Menipis' : 'Aman';
        return `"${p.code}","${p.name}","${p.category}","${p.supplier}",${stock},"${status}"`;
      })
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Laporan_Inventaris_${reportFilter.supplier.replace(/\s+/g, '_')}_${reportFilter.month.replace(
        /\s+/g,
        '_'
      )}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If user is not authenticated, render Login Screen at initial load
  if (!isLoggedIn) {
    return (
      <>
        <LoginScreen
          users={users}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onForgotPassword={() => setIsForgotPasswordOpen(true)}
        />
        <RequestAccessModal
          isOpen={isRequestAccessOpen}
          onClose={() => setIsRequestAccessOpen(false)}
        />
        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#fbf8ff] text-[#1a1b22] overflow-hidden">
      {/* Primary Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setMobileSidebarOpen(false);
        }}
        isMobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onLogout={() => setIsLoggedIn(false)}
        lowStockCount={lowStockCount}
      />

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Navbar */}
        <TopNavbar
          activeTab={activeTab}
          user={user}
          onToggleMobileMenu={() => setMobileSidebarOpen(true)}
          onLogout={() => setIsLoggedIn(false)}
          onNavigate={(tab) => setActiveTab(tab)}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          onOpenCriticalMessageModal={handleOpenCriticalMessageModal}
          products={products}
          transactions={transactions}
          syncState={syncState}
          onOpenGoogleSheetsModal={() => setIsGoogleSheetsModalOpen(true)}
        />

        {/* Realtime Critical Stock Popup Toast */}
        {activeCriticalAlert && (
          <div className="bg-[#ba1a1a] text-white px-4 py-2.5 shadow-md flex items-center justify-between z-30 animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>
                <strong>Stok Kritis Terdeteksi:</strong> {activeCriticalAlert.productName} tersisa{' '}
                <span className="font-bold underline">{activeCriticalAlert.remainingStock}</span> (Batas Min: {activeCriticalAlert.minStock}).
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  handleOpenCriticalMessageModal(activeCriticalAlert.supplier);
                  setActiveCriticalAlert(null);
                }}
                className="px-3 py-1 bg-white text-[#ba1a1a] rounded-lg text-[12px] font-bold hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Kirim Pesan ke Supplier
              </button>
              <button
                onClick={() => setActiveCriticalAlert(null)}
                className="p-1 hover:bg-white/20 rounded text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#fbf8ff]">
          {activeTab === 'dashboard' && (
            <DashboardView
              products={products}
              transactions={transactions}
              onNavigate={(tab) => setActiveTab(tab)}
              onQuickAddProduct={() => setIsAddProductOpen(true)}
              onQuickAddTransaction={() => setIsAddTransactionOpen(true)}
              onOpenCriticalMessageModal={handleOpenCriticalMessageModal}
            />
          )}

          {activeTab === 'produk' && (
            <ProductsView
              products={products}
              suppliers={suppliers}
              searchQuery={globalSearch}
              onSearchChange={setGlobalSearch}
              onOpenAddModal={() => setIsAddProductOpen(true)}
              onOpenEditModal={(prod) => {
                setEditingProduct(prod);
                setIsEditProductOpen(true);
              }}
              onDeleteProduct={handleDeleteProduct}
              onOpenImportModal={() => setIsImportModalOpen(true)}
              onExportExcel={handleExportProductsExcel}
              onClearAllProducts={handleClearAllProducts}
              onResetDefaultProducts={handleResetDefaultProducts}
            />
          )}

          {activeTab === 'stok' && (
            <StockView
              products={products}
              transactions={transactions}
              onUpdateStock={handleUpdateStock}
              onOpenCriticalMessageModal={handleOpenCriticalMessageModal}
              onSyncStockFromTransactions={handleSyncStockFromTransactions}
              onResetStockToZero={handleResetStockToZero}
              onClearStockAndTransactions={handleClearStockAndTransactions}
            />
          )}

          {activeTab === 'transaksi' && (
            <TransactionsView
              transactions={transactions}
              onOpenAddTransactionModal={(type = 'IN') => {
                setTransactionEntryType(type);
                setIsAddTransactionOpen(true);
              }}
              onOpenSalesExportModal={() => setIsSalesExportOpen(true)}
            />
          )}

          {activeTab === 'supplier' && (
            <SuppliersView
              suppliers={suppliers}
              products={products}
              onOpenAddSupplierModal={() => setIsAddSupplierOpen(true)}
              onEditSupplier={handleEditSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onToggleStatus={handleToggleSupplierStatus}
              onOpenCriticalMessageModal={handleOpenCriticalMessageModal}
            />
          )}

          {activeTab === 'laporan' && (
            <ReportView
              products={products}
              suppliers={suppliers}
              transactions={transactions}
              reportFilter={reportFilter}
              onOpenFilterModal={() => setIsReportFilterOpen(true)}
              onExportExcel={handleExportReportExcel}
              onOpenSalesExportModal={() => setIsSalesExportOpen(true)}
              currentUser={user}
            />
          )}

          {(activeTab === 'pengaturan' || activeTab === 'setting') && (
            <SettingsView
              user={user}
              users={users}
              onUpdateUser={handleUpdateCurrentProfile}
              onAddUser={handleAddUser}
              onEditUser={handleEditUser}
              onDeleteUser={handleDeleteUser}
              onToggleUserStatus={handleToggleUserStatus}
              onLogout={() => setIsLoggedIn(false)}
              syncState={syncState}
              onConnectGoogle={handleConnectGoogle}
              onDisconnectGoogle={handleDisconnectGoogle}
              onSyncNow={handleSyncNow}
              onToggleAutoSync={handleToggleAutoSync}
              products={products}
              suppliers={suppliers}
              transactions={transactions}
              onOpenGoogleSheetsModal={() => setIsGoogleSheetsModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Global Action Modals */}
      <GoogleSheetsSyncModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        syncState={syncState}
        onConnectGoogle={handleConnectGoogle}
        onConnectWebApp={handleConnectWebApp}
        onConnectManualToken={handleConnectManualToken}
        onDisconnectGoogle={handleDisconnectGoogle}
        onSyncNow={handleSyncNow}
        onToggleAutoSync={handleToggleAutoSync}
        onUpdateSpreadsheetId={handleUpdateSpreadsheetId}
        products={products}
        suppliers={suppliers}
        transactions={transactions}
      />

      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onAddProduct={handleAddProduct}
        suppliers={suppliers}
      />

      <EditProductModal
        isOpen={isEditProductOpen}
        onClose={() => {
          setIsEditProductOpen(false);
          setEditingProduct(null);
        }}
        onUpdateProduct={handleUpdateProduct}
        product={editingProduct}
        suppliers={suppliers}
      />

      <ImportExportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportProducts={handleImportProducts}
        existingSuppliers={suppliers}
      />

      <ReportFilterModal
        isOpen={isReportFilterOpen}
        onClose={() => setIsReportFilterOpen(false)}
        filter={reportFilter}
        onApplyFilter={setReportFilter}
        suppliers={suppliers}
      />

      <AddTransactionModal
        isOpen={isAddTransactionOpen}
        onClose={() => setIsAddTransactionOpen(false)}
        onAddTransaction={handleAddTransaction}
        products={products}
        suppliers={suppliers}
        transactions={transactions}
        initialType={transactionEntryType}
      />

      <AddSupplierModal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        onAddSupplier={handleAddSupplier}
      />

      <EditSupplierModal
        isOpen={isEditSupplierOpen}
        onClose={() => {
          setIsEditSupplierOpen(false);
          setEditingSupplier(null);
        }}
        onUpdateSupplier={handleUpdateSupplier}
        supplier={editingSupplier}
      />

      <CriticalStockMessageModal
        isOpen={isCriticalMessageOpen}
        onClose={() => {
          setIsCriticalMessageOpen(false);
          setCriticalMessageSupplier(undefined);
        }}
        products={products}
        suppliers={suppliers}
        transactions={transactions}
        initialSupplierName={criticalMessageSupplier}
      />

      <SalesExportModal
        isOpen={isSalesExportOpen}
        onClose={() => setIsSalesExportOpen(false)}
        transactions={transactions}
        products={products}
        suppliers={suppliers}
        currentUser={user}
      />
    </div>
  );
};

export default App;
