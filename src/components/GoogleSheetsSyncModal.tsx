import React, { useState } from 'react';
import { GoogleSheetsSyncState, Product, Supplier, Transaction } from '../types';
import {
  getCurrentDomain,
  getSavedWebAppUrl,
  saveWebAppUrl,
  setAccessToken,
  DEFAULT_WEBAPP_URL,
} from '../services/googleAuth';
import { generateAppsScriptCode } from '../services/googleSheetsService';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncState: GoogleSheetsSyncState;
  onConnectGoogle: () => Promise<void>;
  onConnectWebApp: (url: string) => Promise<void>;
  onConnectManualToken: (token: string) => Promise<void>;
  onDisconnectGoogle: () => Promise<void>;
  onSyncNow: (direction: 'push' | 'pull' | 'both') => Promise<void>;
  onToggleAutoSync: (enabled: boolean) => void;
  onUpdateSpreadsheetId: (newId: string) => void;
  products: Product[];
  suppliers: Supplier[];
  transactions: Transaction[];
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  syncState,
  onConnectGoogle,
  onConnectWebApp,
  onConnectManualToken,
  onDisconnectGoogle,
  onSyncNow,
  onToggleAutoSync,
  onUpdateSpreadsheetId,
  products,
  suppliers,
  transactions,
}) => {
  const [activeTab, setActiveTab] = useState<'webapp' | 'popup' | 'token' | 'guide'>('webapp');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [webAppUrlInput, setWebAppUrlInput] = useState(
    syncState.webAppUrl || getSavedWebAppUrl() || DEFAULT_WEBAPP_URL
  );
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [customSheetId, setCustomSheetId] = useState(syncState.spreadsheetId);
  const [isEditingSheetId, setIsEditingSheetId] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  if (!isOpen) return null;

  const currentDomain = getCurrentDomain();

  const handleAction = async (actionFn: () => Promise<void>, name: string) => {
    try {
      setActiveAction(name);
      setFeedback(null);
      await actionFn();
      setFeedback({ type: 'success', text: `Operasi ${name} berhasil diselesaikan!` });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || `Gagal menjalankan ${name}.`,
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(currentDomain);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2500);
  };

  const handleCopyScript = () => {
    const code = generateAppsScriptCode(syncState.spreadsheetId);
    navigator.clipboard.writeText(code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleSaveSheetId = () => {
    const trimmed = customSheetId.trim();
    if (trimmed) {
      // If user pasted full URL, extract ID
      let idToUse = trimmed;
      if (trimmed.includes('/spreadsheets/d/')) {
        const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) idToUse = match[1];
      }
      onUpdateSpreadsheetId(idToUse);
      setIsEditingSheetId(false);
      setFeedback({ type: 'success', text: 'Target Spreadsheet ID berhasil diperbarui!' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-[#c4c5d5]/40 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00288e] to-[#1e40af] p-6 text-white flex justify-between items-start">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
              <svg className="w-7 h-7 text-[#34A853]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
                <path d="M7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[20px] font-bold tracking-tight">Sinkronisasi Google Sheets</h3>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                    syncState.isConnected
                      ? 'bg-[#6cf8bb]/30 text-[#6cf8bb] border border-[#6cf8bb]/50'
                      : 'bg-white/20 text-white/80'
                  }`}
                >
                  {syncState.isConnected ? 'Terhubung' : 'Belum Terhubung'}
                </span>
              </div>
              <p className="text-[13px] text-white/80 mt-0.5">
                Penyimpanan data inventaris realtime terintegrasi dengan Google Spreadsheet.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Navigation Tabs if not connected */}
        {!syncState.isConnected && (
          <div className="flex border-b border-[#c4c5d5]/30 bg-[#f4f2fc] px-4 pt-2 text-[13px] font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('webapp')}
              className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'webapp'
                  ? 'border-[#00288e] text-[#00288e] bg-white rounded-t-xl shadow-2xs'
                  : 'border-transparent text-[#757684] hover:text-[#1a1b22]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">webhook</span>
              <span className="flex items-center gap-1.5">
                <span>1. Apps Script Web App</span>
                <span className="text-[10px] bg-[#6cf8bb]/30 text-[#006c49] px-1.5 py-0.5 rounded font-bold">Rekomendasi</span>
              </span>
            </button>
            <button
              onClick={() => setActiveTab('popup')}
              className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'popup'
                  ? 'border-[#00288e] text-[#00288e] bg-white rounded-t-xl shadow-2xs'
                  : 'border-transparent text-[#757684] hover:text-[#1a1b22]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">account_circle</span>
              <span>2. Login Google Pop-up</span>
            </button>
            <button
              onClick={() => setActiveTab('token')}
              className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'token'
                  ? 'border-[#00288e] text-[#00288e] bg-white rounded-t-xl shadow-2xs'
                  : 'border-transparent text-[#757684] hover:text-[#1a1b22]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">key</span>
              <span>3. Token Manual</span>
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'guide'
                  ? 'border-[#00288e] text-[#00288e] bg-white rounded-t-xl shadow-2xs'
                  : 'border-transparent text-[#757684] hover:text-[#1a1b22]'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">help</span>
              <span>Panduan Domain</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-[14px]">
          {/* Feedback Alert */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl flex items-start gap-3 text-[13px] ${
                feedback.type === 'success'
                  ? 'bg-[#6cf8bb]/20 text-[#00714d] border border-[#6cf8bb]/40'
                  : feedback.type === 'info'
                  ? 'bg-[#e8f0fe] text-[#174ea6] border border-[#1a73e8]/30'
                  : 'bg-[#ffdad6]/60 text-[#ba1a1a] border border-[#ffdad6]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
                {feedback.type === 'success' ? 'check_circle' : feedback.type === 'info' ? 'info' : 'error'}
              </span>
              <div className="flex-1 font-medium leading-relaxed">{feedback.text}</div>
            </div>
          )}

          {/* Spreadsheet Target Info Card */}
          <div className="p-4 rounded-2xl bg-[#f4f2fc] border border-[#c4c5d5]/40 space-y-3">
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#757684]">
                    Target Spreadsheet ID
                  </span>
                  <button
                    onClick={() => setIsEditingSheetId(!isEditingSheetId)}
                    className="text-[11px] text-[#00288e] hover:underline font-bold"
                  >
                    {isEditingSheetId ? 'Batal' : 'Ubah Sheet'}
                  </button>
                </div>

                {isEditingSheetId ? (
                  <div className="flex gap-2 mt-1.5">
                    <input
                      type="text"
                      value={customSheetId}
                      onChange={(e) => setCustomSheetId(e.target.value)}
                      placeholder="Masukkan ID Spreadsheet atau Link Google Sheet"
                      className="flex-1 px-3 py-1.5 text-[12px] bg-white border border-[#00288e] rounded-xl focus:outline-none"
                    />
                    <button
                      onClick={handleSaveSheetId}
                      className="px-3 py-1.5 bg-[#00288e] text-white text-[12px] font-bold rounded-xl hover:bg-[#1e40af]"
                    >
                      Simpan
                    </button>
                  </div>
                ) : (
                  <p className="font-mono text-[12px] font-semibold text-[#00288e] break-all select-all mt-0.5">
                    {syncState.spreadsheetId}
                  </p>
                )}
              </div>

              <a
                href={syncState.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${syncState.spreadsheetId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-bold text-[#00288e] hover:underline bg-white px-3 py-1.5 rounded-xl border border-[#c4c5d5]/40 shadow-2xs shrink-0 cursor-pointer"
              >
                <span>Buka Sheet</span>
                <span className="material-symbols-outlined text-[15px]">open_in_new</span>
              </a>
            </div>

            <div className="pt-2 border-t border-[#c4c5d5]/30 grid grid-cols-3 gap-2 text-center text-[12px]">
              <div className="bg-white p-2 rounded-xl border border-[#c4c5d5]/30">
                <span className="text-[#757684] block text-[11px]">Tab Produk</span>
                <span className="font-bold text-[#1a1b22] text-[14px]">{products.length} SKU</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-[#c4c5d5]/30">
                <span className="text-[#757684] block text-[11px]">Tab Supplier</span>
                <span className="font-bold text-[#1a1b22] text-[14px]">{suppliers.length} Vendor</span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-[#c4c5d5]/30">
                <span className="text-[#757684] block text-[11px]">Tab Transaksi</span>
                <span className="font-bold text-[#1a1b22] text-[14px]">{transactions.length} Mutasi</span>
              </div>
            </div>
          </div>

          {/* If Connected */}
          {syncState.isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[#6cf8bb]/15 border border-[#6cf8bb]/40">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#006c49] text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">verified_user</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-[#006c49] uppercase tracking-wider block">
                      Google Sheets Terhubung ({syncState.syncMethod === 'webapp' ? 'Web App Apps Script' : 'OAuth API'})
                    </span>
                    <span className="text-[13px] font-bold text-[#1a1b22]">
                      {syncState.googleUserEmail || 'addarasakjd@gmail.com'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAction(onDisconnectGoogle, 'Putus Koneksi')}
                  className="text-[12px] text-[#ba1a1a] hover:underline font-bold px-3 py-1.5 rounded-xl hover:bg-[#ffdad6]/30 cursor-pointer"
                >
                  Putus Koneksi
                </button>
              </div>

              {/* Auto Sync Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-[#c4c5d5]/40 shadow-2xs">
                <div>
                  <h4 className="font-bold text-[#1a1b22] text-[14px]">Auto-Sync Realtime</h4>
                  <p className="text-[12px] text-[#757684]">
                    Setiap penambahan/perubahan produk & transaksi otomatis dikirim ke Google Spreadsheet.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncState.autoSync}
                    onChange={(e) => onToggleAutoSync(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00288e]"></div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleAction(() => onSyncNow('push'), 'Kirim Data ke Sheet')}
                  disabled={activeAction !== null}
                  className="p-3.5 bg-[#00288e] text-white rounded-2xl font-bold hover:bg-[#1e40af] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-[13px] shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                  <span>{activeAction === 'Kirim Data ke Sheet' ? 'Mengunggah...' : 'Kirim / Upload ke Sheet'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAction(() => onSyncNow('pull'), 'Tarik Data dari Sheet')}
                  disabled={activeAction !== null}
                  className="p-3.5 bg-white text-[#00288e] border border-[#00288e] rounded-2xl font-bold hover:bg-[#f4f2fc] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-[13px]"
                >
                  <span className="material-symbols-outlined text-[18px]">cloud_download</span>
                  <span>{activeAction === 'Tarik Data dari Sheet' ? 'Mengunduh...' : 'Tarik dari Sheet'}</span>
                </button>
              </div>

              {syncState.lastSyncedAt && (
                <p className="text-center text-[12px] text-[#757684]">
                  Terakhir disinkronkan: <span className="font-bold text-[#1a1b22]">{syncState.lastSyncedAt}</span>
                </p>
              )}
            </div>
          ) : (
            <div>
              {/* Tab 1: Pop-up Sign-In */}
              {activeTab === 'popup' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl border border-[#00288e]/20 bg-[#00288e]/5 space-y-3">
                    <p className="text-[13px] text-[#444653]">
                      Hubungkan akun Google Anda untuk mengaktifkan sinkronisasi otomatis dan realtime ke Google Spreadsheet.
                    </p>

                    <button
                      type="button"
                      onClick={() => handleAction(onConnectGoogle, 'Koneksi Google')}
                      disabled={activeAction !== null}
                      className="w-full inline-flex items-center justify-center gap-3 px-5 py-3.5 bg-white text-[#1a1b22] border border-[#c4c5d5] rounded-2xl font-bold hover:bg-[#fbf8ff] hover:shadow-md transition-all cursor-pointer disabled:opacity-50 text-[14px]"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 48 48">
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                      </svg>
                      <span>
                        {activeAction === 'Koneksi Google' ? 'Membuka Jendela Login...' : 'Hubungkan dengan Google (Pop-up)'}
                      </span>
                    </button>
                  </div>

                  {/* Domain Whitelist Notice Box */}
                  <div className="p-4 rounded-2xl bg-[#fff8e1] border border-[#ffe082] text-[12px] text-[#795548] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#5d4037] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-[#f57c00]">domain</span>
                        Domain Aplikasi Anda Saat Ini:
                      </span>
                      <button
                        onClick={handleCopyDomain}
                        className="text-[11px] font-bold bg-white text-[#5d4037] border border-[#d7ccc8] px-2.5 py-1 rounded-lg hover:bg-[#fffde7] flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[13px]">content_copy</span>
                        <span>{copiedDomain ? 'Tersalin!' : 'Salin Domain'}</span>
                      </button>
                    </div>
                    <code className="block p-2 bg-white rounded-lg border border-[#e0e0e0] font-mono text-[11px] text-[#3e2723] break-all select-all">
                      {currentDomain}
                    </code>
                    <p className="text-[11px] leading-relaxed text-[#6d4c41]">
                      Jika muncul pesan <em>"auth/unauthorized-domain"</em>, Anda dapat menggunakan <strong>Metode 2 (Apps Script Web App)</strong> yang bebas domain, atau mendaftarkan domain di atas ke Firebase Console.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Apps Script Web App (The Ultimate Zero-Blocker for Netlify) */}
              {activeTab === 'webapp' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#e8f0fe] border border-[#1a73e8]/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#174ea6] font-bold text-[13px]">
                        <span className="material-symbols-outlined text-[18px]">auto_mode</span>
                        <span>Metode Bebas Domain (100% Berhasil di Netlify & Hosting Mana Saja)</span>
                      </div>
                    </div>
                    <p className="text-[12px] text-[#1967d2] leading-relaxed">
                      Hubungkan Spreadsheet langsung menggunakan Google Apps Script Web App. Tidak perlu otorisasi domain Firebase dan tidak akan pernah kadaluarsa!
                    </p>

                    <div>
                      <label className="block text-[11px] font-bold text-[#174ea6] uppercase tracking-wider mb-1">
                        URL Web App Google Apps Script:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={webAppUrlInput}
                          onChange={(e) => setWebAppUrlInput(e.target.value)}
                          placeholder="https://script.google.com/macros/s/.../exec"
                          className="flex-1 px-3 py-2 text-[13px] bg-white border border-[#1a73e8]/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/20"
                        />
                        <button
                          type="button"
                          onClick={() => handleAction(() => onConnectWebApp(webAppUrlInput.trim()), 'Koneksi Apps Script')}
                          disabled={!webAppUrlInput.trim() || activeAction !== null}
                          className="px-4 py-2 bg-[#1a73e8] text-white font-bold rounded-xl hover:bg-[#174ea6] disabled:opacity-50 cursor-pointer text-[13px]"
                        >
                          {activeAction === 'Koneksi Apps Script' ? 'Menguji...' : 'Hubungkan'}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#1a73e8]/20 flex items-center justify-between">
                      <span className="text-[11px] text-[#174ea6] font-medium">
                        Belum punya skrip? Salin kode skrip siap pakai:
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyScript}
                        className="px-3 py-1.5 bg-white text-[#1a73e8] border border-[#1a73e8]/40 rounded-xl text-[12px] font-bold hover:bg-[#f8fafd] flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">code</span>
                        <span>{copiedScript ? 'Kode Tersalin!' : 'Salin Skrip Apps Script'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 3 Step Setup Guide */}
                  <div className="p-4 rounded-2xl bg-[#f4f2fc] border border-[#c4c5d5]/40 text-[12px] space-y-2">
                    <span className="font-bold text-[#1a1b22] block">Cara Pasang Skrip (Hanya 1 Menit):</span>
                    <ol className="list-decimal pl-4 space-y-1 text-[#444653]">
                      <li>
                        Buka Google Spreadsheet target &rarr; Klik Menu <strong>Ekstensi</strong> &rarr; <strong>Apps Script</strong>.
                      </li>
                      <li>
                        Hapus kode lama, klik tombol <strong>"Salin Skrip Apps Script"</strong> di atas, lalu Tempel (Paste).
                      </li>
                      <li>
                        Klik tombol biru <strong>Deploy (Terapkan)</strong> &rarr; <strong>New deployment (Penerapan baru)</strong> &rarr; Pilih jenis <strong>Web app</strong>.
                      </li>
                      <li>
                        Pilih <em>Execute as: Me</em> dan <em>Who has access: <strong>Anyone (Siapa saja)</strong></em>.
                      </li>
                      <li>
                        Klik <strong>Deploy</strong>, salin Web App URL yang berakhiran <code>/exec</code>, lalu tempel di kolom atas dan klik <strong>Hubungkan</strong>.
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Tab 3: Token Manual */}
              {activeTab === 'token' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#f4f2fc] border border-[#c4c5d5]/40 space-y-3">
                    <p className="text-[12px] text-[#444653]">
                      Jika Anda memiliki OAuth Access Token dari Google Cloud Console atau OAuth Playground, masukkan di sini:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={manualTokenInput}
                        onChange={(e) => setManualTokenInput(e.target.value)}
                        placeholder="ya29.a0AfH6SM..."
                        className="flex-1 px-3 py-2 text-[13px] bg-white border border-[#c4c5d5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleAction(() => onConnectManualToken(manualTokenInput.trim()), 'Simpan Token')}
                        disabled={!manualTokenInput.trim() || activeAction !== null}
                        className="px-4 py-2 bg-[#00288e] text-white font-bold rounded-xl hover:bg-[#1e40af] disabled:opacity-50 cursor-pointer text-[13px]"
                      >
                        Verifikasi
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Panduan Domain Firebase */}
              {activeTab === 'guide' && (
                <div className="space-y-3 p-4 rounded-2xl bg-[#f4f2fc] border border-[#c4c5d5]/40 text-[12px] text-[#444653]">
                  <h4 className="font-bold text-[#1a1b22] text-[13px]">
                    Cara Mendaftarkan Domain di Firebase Console (Jika ingin menggunakan Pop-up):
                  </h4>
                  <ol className="list-decimal pl-4 space-y-1.5">
                    <li>
                      Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-[#00288e] font-bold underline">Firebase Console</a> &rarr; Pilih Project <code>gen-lang-client-0566352545</code>.
                    </li>
                    <li>
                      Masuk ke menu <strong>Build</strong> &rarr; <strong>Authentication</strong> &rarr; Tab <strong>Settings</strong>.
                    </li>
                    <li>
                      Pilih <strong>Authorized domains</strong> pada menu samping kiri.
                    </li>
                    <li>
                      Klik tombol <strong>Add domain</strong>.
                    </li>
                    <li>
                      Tempel domain Anda: <code className="bg-white px-2 py-0.5 rounded border border-[#c4c5d5] font-bold text-[#00288e]">{currentDomain}</code>
                    </li>
                    <li>
                      Klik <strong>Add</strong>. Selesai! Pop-up Google Sign-in akan langsung berfungsi.
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f4f2fc] border-t border-[#c4c5d5]/30 flex justify-between items-center">
          <span className="text-[11px] text-[#757684]">
            {syncState.isConnected ? 'Status: Terhubung & Siap Sinkron' : 'Pilih metode koneksi yang sesuai'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white text-[#1a1b22] border border-[#c4c5d5]/50 font-bold hover:bg-[#eeedf7] transition-colors text-[13px] cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
