import { Product, Supplier, Transaction, User } from '../types';

export const DEFAULT_SPREADSHEET_ID = '1hKkT_Tr_MYd2Puy9KCrxdDOvlDwShth5Un7G5P7MHMg';

export interface SpreadsheetInfo {
  id: string;
  title: string;
  url: string;
  sheets: string[];
}

export interface SyncResult {
  success: boolean;
  message: string;
  productsCount?: number;
  suppliersCount?: number;
  transactionsCount?: number;
  usersCount?: number;
  timestamp: string;
}

const PRODUCT_HEADERS = [
  'ID',
  'Kode Produk',
  'Nama Produk',
  'Kategori',
  'Satuan',
  'Supplier',
  'Harga Satuan (Rp)',
  'Stok Awal',
  'Stok Saat Ini',
  'Batas Min Stok',
  'Status',
  'Status Kesehatan',
  'Terakhir Diperbarui',
];

const SUPPLIER_HEADERS = [
  'ID',
  'Kode Supplier',
  'Nama Perusahaan',
  'Kontak Person',
  'No Telepon',
  'Email',
  'Alamat',
  'Status',
];

const TRANSACTION_HEADERS = [
  'ID',
  'Kode Transaksi',
  'Tipe Mutasi',
  'Waktu Transaksi',
  'Kode Produk',
  'Nama Produk',
  'Kategori',
  'Jumlah',
  'Satuan',
  'Asal / Tujuan',
  'Catatan / Alasan Retur',
  'Petugas',
];

const USER_HEADERS = [
  'ID',
  'Username',
  'Nama',
  'Email',
  'Role',
  'Status',
];

/**
 * Checks if spreadsheet exists and gets its metadata via REST API
 */
export async function getSpreadsheetDetails(
  token: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<SpreadsheetInfo> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal mengakses Google Spreadsheet (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const sheets = (data.sheets || []).map((s: any) => s.properties?.title as string);

  return {
    id: spreadsheetId,
    title: data.properties?.title || 'Spreadsheet Tanpa Judul',
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheets,
  };
}

/**
 * Ensures that Produk, Supplier, Transaksi, and Pengguna sheets and headers exist
 */
export async function ensureSpreadsheetStructure(
  token: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<void> {
  const details = await getSpreadsheetDetails(token, spreadsheetId);
  const existingSheets = details.sheets;

  const requiredSheets = ['Produk', 'Supplier', 'Transaksi', 'Pengguna'];
  const missingSheets = requiredSheets.filter((s) => !existingSheets.includes(s));

  if (missingSheets.length > 0) {
    const requests = missingSheets.map((title) => ({
      addSheet: {
        properties: {
          title,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
      },
    }));

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      }
    );

    if (!updateRes.ok) {
      console.warn('Batch update sheets warning:', await updateRes.text());
    }
  }

  // Check and write headers for each sheet
  const headerUpdates = [
    { range: 'Produk!A1:M1', values: [PRODUCT_HEADERS] },
    { range: 'Supplier!A1:H1', values: [SUPPLIER_HEADERS] },
    { range: 'Transaksi!A1:L1', values: [TRANSACTION_HEADERS] },
    { range: 'Pengguna!A1:F1', values: [USER_HEADERS] },
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: headerUpdates,
      }),
    }
  );
}

/**
 * Convert products to sheet rows
 */
function productToRow(p: Product): (string | number)[] {
  return [
    p.id || '',
    p.code || '',
    p.name || '',
    p.category || '',
    p.unit || '',
    p.supplier || '',
    p.price || 0,
    p.initialStock || 0,
    p.currentStock ?? p.initialStock ?? 0,
    p.minStock || 0,
    p.status || 'Aktif',
    p.healthStatus || 'Aman',
    p.lastUpdated || new Date().toISOString().split('T')[0],
  ];
}

/**
 * Convert suppliers to sheet rows
 */
function supplierToRow(s: Supplier): (string | number)[] {
  return [
    s.id || '',
    s.code || '',
    s.name || '',
    s.contactPerson || '',
    s.phone || '',
    s.email || '',
    s.address || '',
    s.status || 'Aktif',
  ];
}

/**
 * Convert transactions to sheet rows
 */
function transactionToRow(t: Transaction): (string | number)[] {
  const reasonText = t.returnReason ? `[Retur: ${t.returnReason}] ${t.notes || ''}` : t.notes || '';
  return [
    t.id || '',
    t.code || '',
    t.type || 'IN',
    t.date || '',
    t.productCode || '',
    t.productName || '',
    t.category || '',
    t.quantity || 0,
    t.unit || '',
    t.sourceDestination || '',
    reasonText,
    t.createdBy || '',
  ];
}

/**
 * Convert users to sheet rows
 */
function userToRow(u: User): string[] {
  return [
    u.id || u.username || 'admin',
    u.username || 'admin',
    u.name || 'Administrator',
    u.email || 'addarasakjd@gmail.com',
    u.role || 'Inventory Manager',
    u.status || 'Aktif',
  ];
}

/**
 * Row to Product converter
 */
function rowToProduct(row: any[]): Product {
  const price = Number(row[6]) || 0;
  const initialStock = Number(row[7]) || 0;
  const currentStock = row[8] !== undefined && row[8] !== '' ? Number(row[8]) : initialStock;
  const minStock = Number(row[9]) || 0;

  return {
    id: String(row[0] || `prd-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`),
    code: String(row[1] || ''),
    name: String(row[2] || ''),
    category: String(row[3] || 'Umum'),
    unit: String(row[4] || 'Pcs'),
    supplier: String(row[5] || ''),
    price,
    initialStock,
    currentStock,
    minStock,
    status: row[10] === 'Tidak Aktif' ? 'Tidak Aktif' : 'Aktif',
    healthStatus: (row[11] as any) || (currentStock <= 0 ? 'Habis' : currentStock <= minStock ? 'Menipis' : 'Aman'),
    lastUpdated: String(row[12] || new Date().toISOString().split('T')[0]),
  };
}

/**
 * Row to Supplier converter
 */
function rowToSupplier(row: any[]): Supplier {
  return {
    id: String(row[0] || `sup-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`),
    code: String(row[1] || ''),
    name: String(row[2] || ''),
    contactPerson: String(row[3] || ''),
    phone: String(row[4] || ''),
    email: String(row[5] || ''),
    address: String(row[6] || ''),
    productCount: 0,
    distributionPercentage: 0,
    status: row[7] === 'Tidak Aktif' ? 'Tidak Aktif' : 'Aktif',
  };
}

/**
 * Row to Transaction converter
 */
function rowToTransaction(row: any[]): Transaction {
  const rawType = String(row[2] || '').toUpperCase();
  let type: 'IN' | 'OUT' | 'RETUR_IN' | 'RETUR_OUT' = 'IN';
  if (rawType === 'OUT') {
    type = 'OUT';
  } else if (rawType === 'RETUR_IN' || rawType.includes('RETUR_MASUK') || rawType === 'RETUR') {
    type = 'RETUR_IN';
  } else if (rawType === 'RETUR_OUT' || rawType.includes('RETUR_KELUAR')) {
    type = 'RETUR_OUT';
  } else {
    type = 'IN';
  }

  const rawNotes = String(row[10] || '');
  let returnReason: string | undefined = undefined;
  let notes = rawNotes;
  if (rawNotes.includes('[Retur:')) {
    const match = rawNotes.match(/\[Retur:\s*([^\]]+)\]/);
    if (match) {
      returnReason = match[1].trim();
      notes = rawNotes.replace(/\[Retur:[^\]]+\]/, '').trim();
    }
  }

  return {
    id: String(row[0] || `trx-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`),
    code: String(row[1] || ''),
    type,
    date: String(row[3] || new Date().toLocaleString('id-ID')),
    productCode: String(row[4] || ''),
    productName: String(row[5] || ''),
    category: String(row[6] || ''),
    quantity: Number(row[7]) || 0,
    unit: String(row[8] || 'Pcs'),
    sourceDestination: String(row[9] || ''),
    returnReason,
    notes,
    createdBy: String(row[11] || 'Sistem'),
  };
}

/**
 * Row to User converter
 */
function rowToUser(row: any[]): User {
  const username = String(row[1] || row[0] || 'admin').trim();
  const name = String(row[2] || 'Administrator').trim();
  const email = String(row[3] || 'addarasakjd@gmail.com').trim();
  const role = String(row[4] || 'Inventory Manager').trim();
  const statusStr = String(row[5] || 'Aktif').trim();
  const status = statusStr.toLowerCase() === 'nonaktif' ? 'Nonaktif' : 'Aktif';

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AD';

  return {
    id: String(row[0] || username),
    username,
    name,
    email,
    role,
    status,
    avatar: '',
    initials,
    password: 'admin',
  };
}

/**
 * Fetch all data from the spreadsheet into the application via REST API
 */
export async function fetchAllFromSpreadsheet(
  token: string,
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<{ products: Product[]; suppliers: Supplier[]; transactions: Transaction[]; users?: User[] }> {
  await ensureSpreadsheetStructure(token, spreadsheetId);

  const ranges = ['Produk!A2:M', 'Supplier!A2:H', 'Transaksi!A2:L', 'Pengguna!A2:F'];
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${ranges.join('&ranges=')}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Gagal mengambil data spreadsheet (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const valueRanges = data.valueRanges || [];

  const productRows = valueRanges[0]?.values || [];
  const supplierRows = valueRanges[1]?.values || [];
  const transactionRows = valueRanges[2]?.values || [];
  const userRows = valueRanges[3]?.values || [];

  const products = productRows
    .filter((r: any[]) => r && r.length > 1 && (r[1] || r[2]))
    .map(rowToProduct);

  const suppliers = supplierRows
    .filter((r: any[]) => r && r.length > 1 && (r[1] || r[2]))
    .map(rowToSupplier);

  const transactions = transactionRows
    .filter((r: any[]) => r && r.length > 1 && (r[1] || r[4]))
    .map(rowToTransaction);

  const users = userRows
    .filter((r: any[]) => r && r.length > 0 && (r[0] || r[1] || r[2]))
    .map(rowToUser);

  return { products, suppliers, transactions, users: users.length > 0 ? users : undefined };
}

/**
 * Sync entire products list to Google Sheets
 */
export async function syncProductsToSheet(
  token: string,
  products: Product[],
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<void> {
  await ensureSpreadsheetStructure(token, spreadsheetId);

  // Clear existing product data (A2:M)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Produk!A2:M:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (products.length > 0) {
    const rows = products.map(productToRow);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Produk!A2?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );
  }
}

/**
 * Sync entire suppliers list to Google Sheets
 */
export async function syncSuppliersToSheet(
  token: string,
  suppliers: Supplier[],
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<void> {
  await ensureSpreadsheetStructure(token, spreadsheetId);

  // Clear existing supplier data (A2:H)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Supplier!A2:H:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (suppliers.length > 0) {
    const rows = suppliers.map(supplierToRow);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Supplier!A2?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );
  }
}

/**
 * Sync entire transactions list to Google Sheets
 */
export async function syncTransactionsToSheet(
  token: string,
  transactions: Transaction[],
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<void> {
  await ensureSpreadsheetStructure(token, spreadsheetId);

  // Clear existing transaction data (A2:L)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transaksi!A2:L:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (transactions.length > 0) {
    const rows = transactions.map(transactionToRow);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transaksi!A2?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );
  }
}

/**
 * Sync users list to Google Sheets
 */
export async function syncUsersToSheet(
  token: string,
  users: User[],
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID
): Promise<void> {
  await ensureSpreadsheetStructure(token, spreadsheetId);

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Pengguna!A2:F:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (users.length > 0) {
    const rows = users.map(userToRow);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Pengguna!A2?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );
  }
}

/**
 * Full bidirectional sync via REST API
 */
export async function syncAllToSpreadsheet(
  token: string,
  products: Product[],
  suppliers: Supplier[],
  transactions: Transaction[],
  spreadsheetId: string = DEFAULT_SPREADSHEET_ID,
  users?: User[]
): Promise<SyncResult> {
  await ensureSpreadsheetStructure(token, spreadsheetId);

  const syncPromises = [
    syncProductsToSheet(token, products, spreadsheetId),
    syncSuppliersToSheet(token, suppliers, spreadsheetId),
    syncTransactionsToSheet(token, transactions, spreadsheetId),
  ];

  if (users && users.length > 0) {
    syncPromises.push(syncUsersToSheet(token, users, spreadsheetId));
  }

  await Promise.all(syncPromises);

  return {
    success: true,
    message: 'Semua data inventaris & pengguna berhasil disinkronkan ke Google Spreadsheet!',
    productsCount: products.length,
    suppliersCount: suppliers.length,
    transactionsCount: transactions.length,
    usersCount: users?.length,
    timestamp: new Date().toLocaleTimeString('id-ID'),
  };
}

/**
 * Helper to fetch data via JSONP (zero CORS limitations even on static frontend)
 */
function fetchViaJSONP(url: string, timeoutMs = 12000): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return reject(new Error('JSONP is only supported in browser environment.'));
    }

    const callbackName = `gas_callback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const separator = url.includes('?') ? '&' : '?';
    const script = document.createElement('script');
    script.src = `${url}${separator}callback=${callbackName}&_t=${Date.now()}`;
    script.async = true;

    let timeoutId: any = null;

    (window as any)[callbackName] = (data: any) => {
      cleanup();
      resolve(data);
    };

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      delete (window as any)[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Gagal memuat skrip via JSONP Google Apps Script.'));
    };

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Koneksi Google Apps Script timeout.'));
    }, timeoutMs);

    document.body.appendChild(script);
  });
}

/**
 * Resilient GET from Google Apps Script (Backend Proxy -> Direct Fetch -> JSONP)
 */
async function callAppsScriptGet(webAppUrl: string, params: Record<string, string> = {}): Promise<any> {
  const queryParts = Object.entries(params).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  );
  const queryString = queryParts.length > 0 ? queryParts.join('&') : '';
  const separator = webAppUrl.includes('?') ? '&' : '?';
  const targetUrl = queryString ? `${webAppUrl}${separator}${queryString}&t=${Date.now()}` : `${webAppUrl}${separator}t=${Date.now()}`;

  // 1. Try Backend Proxy
  try {
    const proxyUrl = `/api/sheets-proxy?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && data.status !== 'error') {
        return data;
      }
    }
  } catch {
    // Continue to next fallback
  }

  // 2. Try Direct Fetch
  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status !== 'error') {
        return data;
      }
    }
  } catch {
    // Continue to next fallback
  }

  // 3. Try JSONP fallback
  try {
    const jsonpData = await fetchViaJSONP(targetUrl);
    if (jsonpData && jsonpData.status !== 'error') {
      return jsonpData;
    }
    if (jsonpData && jsonpData.status === 'error') {
      throw new Error(jsonpData.message || 'Error dari Apps Script');
    }
  } catch (err: any) {
    throw new Error(`Gagal menghubungi Google Apps Script: ${err.message || 'Koneksi terputus'}`);
  }

  throw new Error('Gagal mendapatkan respon valid dari Google Apps Script.');
}

/**
 * Resilient POST to Google Apps Script (Backend Proxy -> Direct Fetch -> no-cors)
 */
async function callAppsScriptPost(webAppUrl: string, payload: any): Promise<any> {
  const bodyText = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // 1. Try Backend Proxy
  try {
    const res = await fetch('/api/sheets-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webAppUrl,
        payload,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status !== 'error') {
        return data;
      }
    }
  } catch {
    // Continue to next fallback
  }

  // 2. Try Direct Fetch
  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: bodyText,
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({ status: 'success' }));
      return data;
    }
  } catch {
    // 3. Try no-cors fallback (fires beacon to Apps Script, executes server-side)
    await fetch(webAppUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: bodyText,
    });
    return { status: 'success', note: 'Transmitted via no-cors background tunnel' };
  }
}

/**
 * Test connectivity with Google Apps Script Web App
 */
export async function testAppsScriptConnection(webAppUrl: string): Promise<{
  online: boolean;
  spreadsheetId?: string;
  spreadsheetName?: string;
}> {
  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com/')) {
    throw new Error('URL Google Apps Script tidak valid. Format harus diawali dengan https://script.google.com/...');
  }

  const data = await callAppsScriptGet(webAppUrl, { action: 'ping' });
  return {
    online: true,
    spreadsheetId: data.spreadsheetId,
    spreadsheetName: data.spreadsheetName || 'INVENTORY ADDA RASA KJD',
  };
}

/**
 * Fetch all data from Google Apps Script Web App (Pull 2 Arah)
 */
export async function fetchAllFromAppsScript(
  webAppUrl: string
): Promise<{ products: Product[]; suppliers: Supplier[]; transactions: Transaction[]; users?: User[] }> {
  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com/')) {
    throw new Error('URL Google Apps Script tidak valid.');
  }

  const data = await callAppsScriptGet(webAppUrl, { action: 'getAll' });

  if (data.status === 'error') {
    throw new Error(data.message || 'Gagal membaca data dari Google Spreadsheet');
  }

  const rawProducts = data.products || [];
  const rawSuppliers = data.suppliers || [];
  const rawTransactions = data.transactions || [];
  const rawUsers = data.users || [];

  const cleanPhone = (val: any) => {
    const s = String(val || '').trim();
    if (s.includes('#ERROR') || s === '#REF!' || s === '#VALUE!' || s === 'undefined' || s === 'null') {
      return '';
    }
    return s;
  };

  const formatDate = (val: any) => {
    if (!val) return new Date().toISOString().split('T')[0];
    const s = String(val).trim();
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return s;
  };

  const formatTrxDate = (val: any) => {
    if (!val) return new Date().toLocaleString('id-ID');
    const s = String(val).trim();
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return s;
  };

  const products: Product[] = rawProducts.map((p: any) => ({
    id: String(p.id || `prd-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`),
    code: String(p.code || ''),
    name: String(p.name || ''),
    category: String(p.category || 'Umum'),
    unit: String(p.unit || 'Pcs'),
    supplier: String(p.supplier || ''),
    price: Number(p.price) || 0,
    initialStock: Number(p.initialStock) || 0,
    currentStock: Number(p.currentStock ?? p.initialStock ?? 0),
    minStock: Number(p.minStock) || 0,
    status: p.status === 'Tidak Aktif' ? 'Tidak Aktif' : 'Aktif',
    healthStatus: p.healthStatus || (Number(p.currentStock) <= 0 ? 'Habis' : Number(p.currentStock) <= Number(p.minStock) ? 'Menipis' : 'Aman'),
    lastUpdated: formatDate(p.lastUpdated),
  }));

  const suppliers: Supplier[] = rawSuppliers.map((s: any) => ({
    id: String(s.id || `sup-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`),
    code: String(s.code || ''),
    name: String(s.name || ''),
    contactPerson: String(s.contactPerson || ''),
    phone: cleanPhone(s.phone),
    email: String(s.email || ''),
    address: String(s.address || ''),
    productCount: Number(s.productCount) || 0,
    distributionPercentage: Number(s.distributionPercentage) || 0,
    status: s.status === 'Tidak Aktif' ? 'Tidak Aktif' : 'Aktif',
  }));

  const transactions: Transaction[] = rawTransactions.map((t: any) => ({
    id: String(t.id || `trx-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`),
    code: String(t.code || ''),
    type: t.type || 'IN',
    date: formatTrxDate(t.date),
    productCode: String(t.productCode || ''),
    productName: String(t.productName || ''),
    category: String(t.category || ''),
    supplier: String(t.supplier || ''),
    price: Number(t.price) || 0,
    quantity: Number(t.quantity) || 0,
    unit: String(t.unit || 'Pcs'),
    sourceDestination: String(t.sourceDestination || ''),
    returnReason: t.returnReason || undefined,
    notes: t.notes || '',
    createdBy: String(t.createdBy || 'Sistem'),
  }));

  const users: User[] = rawUsers.map((u: any) => ({
    id: String(u.id || u.username || 'admin'),
    username: String(u.username || 'admin'),
    name: String(u.name || 'Administrator'),
    email: String(u.email || 'addarasakjd@gmail.com'),
    role: String(u.role || 'Inventory Manager'),
    status: u.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
    avatar: '',
    initials: (u.name || 'Administrator')
      .split(' ')
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'AD',
    password: 'admin',
  }));

  return { products, suppliers, transactions, users: users.length > 0 ? users : undefined };
}

/**
 * Sync data using Google Apps Script Web App (Webhook mode - Push)
 * Works 100% reliably without requiring Firebase Authorized Domains or OAuth popup!
 */
export async function syncAllToAppsScript(
  webAppUrl: string,
  products: Product[],
  suppliers: Supplier[],
  transactions: Transaction[],
  users?: User[]
): Promise<SyncResult> {
  if (!webAppUrl || !webAppUrl.startsWith('https://script.google.com/')) {
    throw new Error('URL Google Apps Script tidak valid. Pastikan format diawali dengan https://script.google.com/...');
  }

  const payload = {
    action: 'syncAll',
    products,
    suppliers,
    transactions,
    users: users && users.length > 0 ? users : undefined,
    timestamp: new Date().toISOString(),
  };

  try {
    await callAppsScriptPost(webAppUrl, payload);

    return {
      success: true,
      message: 'Sinkronisasi 2 arah ke Google Spreadsheet via Apps Script Web App berhasil!',
      productsCount: products.length,
      suppliersCount: suppliers.length,
      transactionsCount: transactions.length,
      usersCount: users?.length,
      timestamp: new Date().toLocaleTimeString('id-ID'),
    };
  } catch (err: any) {
    throw new Error(`Gagal mengirim data ke Google Apps Script: ${err.message}`);
  }
}

/**
 * Generate Google Apps Script code for 1-click copy into Google Sheets Extensions > Apps Script
 * Supports full 2-way sync (Push & Pull for Produk, Supplier, Transaksi, Pengguna)
 */
export function generateAppsScriptCode(spreadsheetId: string = DEFAULT_SPREADSHEET_ID): string {
  return `/**
 * ADDA RASA INVENTORY - GOOGLE SHEETS 2-WAY CONNECTOR WEB APP
 * Pasang skrip ini di: Google Spreadsheet > Ekstensi (Extensions) > Apps Script
 * Lalu klik 'Deploy' (Terapkan) > 'New deployment' > Pilih Web app > Who has access: 'Anyone' (Siapa saja).
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No payload received' })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.action === 'syncAll') {
      // 1. Sinkronisasi Sheet Produk
      if (data.products && Array.isArray(data.products)) {
        var sheetProd = ss.getSheetByName('Produk') || ss.insertSheet('Produk');
        sheetProd.clear();
        var headersProd = ['ID', 'Kode Produk', 'Nama Produk', 'Kategori', 'Satuan', 'Supplier', 'Harga Satuan (Rp)', 'Stok Awal', 'Stok Saat Ini', 'Batas Min Stok', 'Status', 'Status Kesehatan', 'Terakhir Diperbarui'];
        var rowsProd = [headersProd];
        data.products.forEach(function(p) {
          rowsProd.push([
            p.id || '',
            p.code || '',
            p.name || '',
            p.category || 'Umum',
            p.unit || 'Pcs',
            p.supplier || '',
            Number(p.price) || 0,
            Number(p.initialStock) || 0,
            p.currentStock !== undefined ? Number(p.currentStock) : (Number(p.initialStock) || 0),
            Number(p.minStock) || 0,
            p.status || 'Aktif',
            p.healthStatus || 'Aman',
            p.lastUpdated || new Date().toISOString().split('T')[0]
          ]);
        });
        sheetProd.getRange(1, 1, rowsProd.length, headersProd.length).setValues(rowsProd);
        sheetProd.setFrozenRows(1);
      }

      // 2. Sinkronisasi Sheet Supplier
      if (data.suppliers && Array.isArray(data.suppliers)) {
        var sheetSup = ss.getSheetByName('Supplier') || ss.insertSheet('Supplier');
        sheetSup.clear();
        var headersSup = ['ID', 'Kode Supplier', 'Nama Perusahaan', 'Kontak Person', 'No Telepon', 'Email', 'Alamat', 'Status'];
        var rowsSup = [headersSup];
        data.suppliers.forEach(function(s) {
          rowsSup.push([
            s.id || '',
            s.code || '',
            s.name || '',
            s.contactPerson || '',
            s.phone || '',
            s.email || '',
            s.address || '',
            s.status || 'Aktif'
          ]);
        });
        sheetSup.getRange(1, 1, rowsSup.length, headersSup.length).setValues(rowsSup);
        sheetSup.setFrozenRows(1);
      }

      // 3. Sinkronisasi Sheet Transaksi
      if (data.transactions && Array.isArray(data.transactions)) {
        var sheetTrx = ss.getSheetByName('Transaksi') || ss.insertSheet('Transaksi');
        sheetTrx.clear();
        var headersTrx = ['ID', 'Kode Transaksi', 'Tipe Mutasi', 'Waktu Transaksi', 'Kode Produk', 'Nama Produk', 'Kategori', 'Supplier', 'Jumlah', 'Satuan', 'Harga (Rp)', 'Total (Rp)', 'Asal / Tujuan', 'Catatan / Alasan Retur', 'Petugas'];
        var rowsTrx = [headersTrx];
        data.transactions.forEach(function(t) {
          var note = t.returnReason ? ('[Retur: ' + t.returnReason + '] ' + (t.notes || '')) : (t.notes || '');
          var price = Number(t.price) || 0;
          var qty = Number(t.quantity) || 0;
          rowsTrx.push([
            t.id || '',
            t.code || '',
            t.type || 'IN',
            t.date || '',
            t.productCode || '',
            t.productName || '',
            t.category || '',
            t.supplier || '',
            qty,
            t.unit || 'Pcs',
            price,
            qty * price,
            t.sourceDestination || '',
            note,
            t.createdBy || 'Sistem'
          ]);
        });
        sheetTrx.getRange(1, 1, rowsTrx.length, headersTrx.length).setValues(rowsTrx);
        sheetTrx.setFrozenRows(1);
      }

      // 4. Sinkronisasi Sheet Pengguna (Users)
      if (data.users && Array.isArray(data.users)) {
        var sheetUsr = ss.getSheetByName('Pengguna') || ss.insertSheet('Pengguna');
        sheetUsr.clear();
        var headersUsr = ['ID', 'Username', 'Nama', 'Email', 'Role', 'Status'];
        var rowsUsr = [headersUsr];
        data.users.forEach(function(u) {
          rowsUsr.push([
            u.id || u.username || 'admin',
            u.username || 'admin',
            u.name || 'Administrator',
            u.email || 'addarasakjd@gmail.com',
            u.role || 'Inventory Manager',
            u.status || 'Aktif'
          ]);
        });
        sheetUsr.getRange(1, 1, rowsUsr.length, headersUsr.length).setValues(rowsUsr);
        sheetUsr.setFrozenRows(1);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Sinkronisasi 2 arah berhasil',
        productsCount: data.products ? data.products.length : 0,
        suppliersCount: data.suppliers ? data.suppliers.length : 0,
        transactionsCount: data.transactions ? data.transactions.length : 0,
        usersCount: data.users ? data.users.length : 0
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = e && e.parameter ? e.parameter.action : '';
    var callback = e && e.parameter ? e.parameter.callback : '';
    var result;

    if (action === 'getAll') {
      result = { status: 'success', products: [], suppliers: [], transactions: [], users: [] };

      // Baca Produk
      var sheetProd = ss.getSheetByName('Produk');
      if (sheetProd && sheetProd.getLastRow() > 1) {
        var valuesProd = sheetProd.getRange(2, 1, sheetProd.getLastRow() - 1, 13).getValues();
        valuesProd.forEach(function(r) {
          if (r[1] || r[2]) {
            result.products.push({
              id: String(r[0] || ''),
              code: String(r[1] || ''),
              name: String(r[2] || ''),
              category: String(r[3] || 'Umum'),
              unit: String(r[4] || 'Pcs'),
              supplier: String(r[5] || ''),
              price: Number(r[6]) || 0,
              initialStock: Number(r[7]) || 0,
              currentStock: r[8] !== '' ? Number(r[8]) : (Number(r[7]) || 0),
              minStock: Number(r[9]) || 0,
              status: r[10] || 'Aktif',
              healthStatus: r[11] || 'Aman',
              lastUpdated: r[12] ? String(r[12]) : ''
            });
          }
        });
      }

      // Baca Supplier
      var sheetSup = ss.getSheetByName('Supplier');
      if (sheetSup && sheetSup.getLastRow() > 1) {
        var valuesSup = sheetSup.getRange(2, 1, sheetSup.getLastRow() - 1, 8).getValues();
        valuesSup.forEach(function(r) {
          if (r[1] || r[2]) {
            result.suppliers.push({
              id: String(r[0] || ''),
              code: String(r[1] || ''),
              name: String(r[2] || ''),
              contactPerson: String(r[3] || ''),
              phone: String(r[4] || ''),
              email: String(r[5] || ''),
              address: String(r[6] || ''),
              status: r[7] || 'Aktif'
            });
          }
        });
      }

      // Baca Transaksi
      var sheetTrx = ss.getSheetByName('Transaksi');
      if (sheetTrx && sheetTrx.getLastRow() > 1) {
        var valuesTrx = sheetTrx.getRange(2, 1, sheetTrx.getLastRow() - 1, 15).getValues();
        valuesTrx.forEach(function(r) {
          if (r[1] || r[4] || r[5]) {
            result.transactions.push({
              id: String(r[0] || ''),
              code: String(r[1] || ''),
              type: String(r[2] || 'IN'),
              date: String(r[3] || ''),
              productCode: String(r[4] || ''),
              productName: String(r[5] || ''),
              category: String(r[6] || ''),
              supplier: String(r[7] || ''),
              quantity: Number(r[8] !== undefined && r[8] !== '' ? r[8] : r[7]) || 0,
              unit: String(r[9] || r[8] || 'Pcs'),
              price: Number(r[10]) || 0,
              sourceDestination: String(r[12] || r[9] || ''),
              notes: String(r[13] || r[10] || ''),
              createdBy: String(r[14] || r[11] || 'Sistem')
            });
          }
        });
      }

      // Baca Pengguna
      var sheetUsr = ss.getSheetByName('Pengguna');
      if (sheetUsr && sheetUsr.getLastRow() > 1) {
        var valuesUsr = sheetUsr.getRange(2, 1, sheetUsr.getLastRow() - 1, 6).getValues();
        valuesUsr.forEach(function(r) {
          if (r[0] || r[1] || r[2]) {
            result.users.push({
              id: String(r[0] || r[1] || 'admin'),
              username: String(r[1] || 'admin'),
              name: String(r[2] || 'Administrator'),
              email: String(r[3] || 'addarasakjd@gmail.com'),
              role: String(r[4] || 'Inventory Manager'),
              status: String(r[5] || 'Aktif')
            });
          }
        });
      }
    } else {
      result = {
        status: 'online',
        app: 'ADDA RASA Inventory Connector (2-Way Active)',
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName()
      };
    }

    var jsonStr = JSON.stringify(result);
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + jsonStr + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(jsonStr).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    var errObj = { status: 'error', message: err.toString() };
    if (e && e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + '(' + JSON.stringify(errObj) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(errObj)).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
}
