import React, { useState } from 'react';

interface ResetStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  productCount: number;
  transactionCount: number;
  onResetStockToZero: () => void;
  onClearStockAndTransactions: () => void;
}

export const ResetStockModal: React.FC<ResetStockModalProps> = ({
  isOpen,
  onClose,
  productCount,
  transactionCount,
  onResetStockToZero,
  onClearStockAndTransactions,
}) => {
  const [selectedAction, setSelectedAction] = useState<'zero_stock' | 'clear_all' | null>(null);
  const [confirmText, setConfirmText] = useState('');

  if (!isOpen) return null;

  const handleExecute = () => {
    if (selectedAction === 'zero_stock') {
      onResetStockToZero();
      onClose();
      setSelectedAction(null);
      setConfirmText('');
    } else if (selectedAction === 'clear_all') {
      onClearStockAndTransactions();
      onClose();
      setSelectedAction(null);
      setConfirmText('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-[24px] max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#c4c5d5]/40 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-[#c4c5d5]/30">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#ba1a1a]/10 text-[#ba1a1a] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[26px]">inventory_2</span>
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-[#1a1b22]">
                Hapus & Reset Data Stok
              </h3>
              <p className="text-[12px] text-[#444653]">
                Total: <strong className="text-[#00288e]">{productCount} Produk</strong> &bull;{' '}
                <strong className="text-[#00288e]">{transactionCount} Riwayat Mutasi</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              setSelectedAction(null);
              setConfirmText('');
            }}
            className="p-1.5 rounded-full text-[#757684] hover:bg-[#e8e7f1] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Action Selection */}
        <div className="space-y-3.5 my-5">
          <p className="text-[13px] font-medium text-[#1a1b22]">
            Pilih metode penghapusan/reset stok yang ingin Anda lakukan:
          </p>

          {/* Option 1: Setel Semua Kuantitas Stok Menjadi 0 */}
          <div
            onClick={() => {
              setSelectedAction('zero_stock');
              setConfirmText('');
            }}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
              selectedAction === 'zero_stock'
                ? 'border-[#00288e] bg-[#f0effa] shadow-sm'
                : 'border-[#c4c5d5]/40 hover:border-[#00288e]/40 bg-white'
            }`}
          >
            <div className="w-5 h-5 rounded-full border-2 border-[#00288e] flex items-center justify-center mt-0.5 shrink-0">
              {selectedAction === 'zero_stock' && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#00288e]" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-[14px] font-bold text-[#00288e] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">exposure_zero</span>
                  <span>Nol-kan Semua Stok (Kuantitas 0)</span>
                </h4>
                <span className="text-[11px] font-bold bg-[#dde1ff] text-[#00288e] px-2 py-0.5 rounded-full">
                  Stok = 0
                </span>
              </div>
              <p className="text-[12px] text-[#444653] mt-1 leading-relaxed">
                Mengatur kuantitas stok fisik seluruh {productCount} barang menjadi <strong>0 unit</strong> (nama & daftar produk tetap ada di katalog).
              </p>
            </div>
          </div>

          {/* Option 2: Bersihkan Stok & Seluruh Riwayat Mutasi */}
          <div
            onClick={() => {
              setSelectedAction('clear_all');
              setConfirmText('');
            }}
            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
              selectedAction === 'clear_all'
                ? 'border-[#ba1a1a] bg-[#fff8f7] shadow-sm'
                : 'border-[#c4c5d5]/40 hover:border-[#ba1a1a]/40 bg-white'
            }`}
          >
            <div className="w-5 h-5 rounded-full border-2 border-[#ba1a1a] flex items-center justify-center mt-0.5 shrink-0">
              {selectedAction === 'clear_all' && (
                <div className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-[14px] font-bold text-[#ba1a1a] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                  <span>Hapus Stok & Seluruh Riwayat Mutasi</span>
                </h4>
                <span className="text-[11px] font-bold bg-[#ffdad6] text-[#ba1a1a] px-2 py-0.5 rounded-full">
                  Reset Bersih
                </span>
              </div>
              <p className="text-[12px] text-[#444653] mt-1 leading-relaxed">
                Mengosongkan kuantitas stok menjadi <strong>0 unit</strong> dan menghapus <strong>semua ({transactionCount}) data riwayat mutasi</strong> (Barang Masuk, Penjualan, Retur).
              </p>
            </div>
          </div>
        </div>

        {/* Confirmation safety box */}
        {selectedAction && (
          <div className="p-3.5 bg-[#fff8f7] border border-[#ffdad6] rounded-xl text-[12px] space-y-2 animate-in fade-in">
            <p className="font-semibold text-[#ba1a1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              <span>Konfirmasi Keamanan Penghapusan Data Stok</span>
            </p>
            <p className="text-[#444653]">
              Ketik kata <strong className="text-[#ba1a1a] font-mono">HAPUS</strong> di bawah untuk mengonfirmasi tindakan:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="Ketik HAPUS..."
              className="w-full px-3 py-1.5 border border-[#ba1a1a]/50 rounded-lg text-[13px] font-mono tracking-wider text-[#ba1a1a] bg-white outline-none focus:ring-2 focus:ring-[#ba1a1a]/30"
              autoFocus
            />
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#c4c5d5]/30 mt-5">
          <button
            type="button"
            onClick={() => {
              onClose();
              setSelectedAction(null);
              setConfirmText('');
            }}
            className="px-4 py-2 border border-[#c4c5d5] rounded-xl text-[13px] font-semibold text-[#444653] hover:bg-[#f4f2fc] transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={!selectedAction || confirmText !== 'HAPUS'}
            onClick={handleExecute}
            className={`px-5 py-2 rounded-xl text-[13px] font-bold text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              selectedAction === 'clear_all'
                ? 'bg-[#ba1a1a] hover:bg-[#93000a]'
                : 'bg-[#00288e] hover:bg-[#1e40af]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {selectedAction === 'clear_all' ? 'delete_sweep' : 'exposure_zero'}
            </span>
            <span>
              {selectedAction === 'clear_all'
                ? 'Ya, Hapus Stok & Mutasi'
                : selectedAction === 'zero_stock'
                ? 'Ya, Nol-kan Seluruh Stok'
                : 'Pilih Tindakan'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
