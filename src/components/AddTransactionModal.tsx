import React, { useState, useEffect, useRef } from 'react';
import { Product, Supplier, Transaction } from '../types';
import { getRealStock } from '../utils/stockCalculator';

export type AllowedTransactionEntryType = 'IN' | 'OUT' | 'RETUR_OUT';

interface SessionSavedItem {
  id: string;
  code: string;
  type: AllowedTransactionEntryType;
  productName: string;
  productCode: string;
  supplier: string;
  quantity: number;
  unit: string;
  sourceDestination: string;
  timestamp: string;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (trx: Omit<Transaction, 'id'>) => void;
  products: Product[];
  suppliers?: Supplier[];
  transactions?: Transaction[];
  initialType?: AllowedTransactionEntryType;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  products,
  suppliers = [],
  transactions = [],
  initialType = 'IN',
}) => {
  const [type, setType] = useState<AllowedTransactionEntryType>(initialType);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [productId, setProductId] = useState<string>(products[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [sourceDestination, setSourceDestination] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('Barang Rusak / Cacat Pabrik');
  const [notes, setNotes] = useState<string>('');

  // Batch session recording state
  const [sessionSavedItems, setSessionSavedItems] = useState<SessionSavedItem[]>([]);
  const [successBanner, setSuccessBanner] = useState<{
    message: string;
    productName: string;
    quantity: number;
    unit: string;
  } | null>(null);

  const productSelectRef = useRef<HTMLSelectElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever modal opens or initialType changes
  useEffect(() => {
    if (isOpen) {
      const activeType = initialType || 'IN';
      setType(activeType);
      setDate(new Date().toISOString().split('T')[0]);
      setSessionSavedItems([]);
      setSuccessBanner(null);

      const defaultProd = products[0];
      if (defaultProd) {
        setProductId(defaultProd.id);
        const prodSupplier = defaultProd.supplier || suppliers[0]?.name || 'Adda Rasa';
        setSelectedSupplier(prodSupplier);
        if (activeType === 'IN' || activeType === 'RETUR_OUT') {
          setSourceDestination(prodSupplier);
        } else {
          setSourceDestination('Konsumen / Outlet');
        }
      }
      setQuantity(1);
      setReturnReason('Barang Rusak / Cacat Pabrik');
      setNotes('');
    }
  }, [isOpen, initialType, products, suppliers]);

  if (!isOpen) return null;

  const selectedProd = products.find((p) => p.id === productId) || products[0];

  const SUPPLIER_RETUR_REASONS = [
    'Barang Rusak / Cacat Pabrik',
    'Mendekati / Lewat Kadaluarsa (Expired)',
    'Kemasan Bocor / Rusak saat Pengiriman',
    'Kualitas Tidak Sesuai Standar Mutu',
    'Salah Kirim Barang dari Supplier',
    'Kelebihan Pasokan / Penyesuaian PO',
    'Lainnya (Tulis di Catatan)',
  ];

  const handleTypeChange = (newType: AllowedTransactionEntryType) => {
    setType(newType);
    const prodSupplier = selectedProd?.supplier || suppliers[0]?.name || 'Adda Rasa';
    setSelectedSupplier(prodSupplier);
    if (newType === 'IN' || newType === 'RETUR_OUT') {
      setSourceDestination(prodSupplier);
    } else if (newType === 'OUT') {
      setSourceDestination('Konsumen / Outlet');
    }
  };

  const handleProductChange = (newProductId: string) => {
    setProductId(newProductId);
    const prod = products.find((p) => p.id === newProductId);
    if (prod) {
      const prodSupplier = prod.supplier || suppliers[0]?.name || 'Adda Rasa';
      setSelectedSupplier(prodSupplier);
      if (type === 'IN' || type === 'RETUR_OUT') {
        setSourceDestination(prodSupplier);
      }
    }
  };

  const processSave = (closeAfterSave: boolean) => {
    if (!selectedProd) return;

    const isRetur = type === 'RETUR_OUT';
    const finalQuantity = Number(quantity) || 1;
    const generatedCode = `TRX-${Date.now().toString().slice(-6)}`;
    const effectiveSupplier = selectedSupplier || selectedProd.supplier || suppliers[0]?.name || 'Adda Rasa';
    const finalDestination = sourceDestination.trim() || (isRetur ? effectiveSupplier : type === 'IN' ? effectiveSupplier : 'Konsumen / Outlet');

    const trxData: Omit<Transaction, 'id'> = {
      code: generatedCode,
      type,
      productId: selectedProd.id,
      productCode: selectedProd.code,
      productName: selectedProd.name,
      category: selectedProd.category,
      supplier: effectiveSupplier,
      price: selectedProd.price || 0,
      quantity: finalQuantity,
      unit: selectedProd.unit,
      sourceDestination: finalDestination,
      returnReason: isRetur ? returnReason : undefined,
      date: date || new Date().toISOString().split('T')[0],
      notes: isRetur && returnReason
        ? `[RETUR KE SUPPLIER: ${returnReason}] ${notes}`.trim()
        : notes,
      createdBy: 'Administrator',
    };

    onAddTransaction(trxData);

    // Add to session log
    const savedItem: SessionSavedItem = {
      id: generatedCode,
      code: generatedCode,
      type,
      productName: selectedProd.name,
      productCode: selectedProd.code,
      supplier: effectiveSupplier,
      quantity: finalQuantity,
      unit: selectedProd.unit,
      sourceDestination: finalDestination,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setSessionSavedItems((prev) => [savedItem, ...prev]);

    if (closeAfterSave) {
      onClose();
    } else {
      // Show feedback banner and reset for next item input
      setSuccessBanner({
        message: type === 'OUT' ? 'Penjualan berhasil dicatat' : type === 'IN' ? 'Barang masuk berhasil dicatat' : 'Retur berhasil dicatat',
        productName: selectedProd.name,
        quantity: finalQuantity,
        unit: selectedProd.unit,
      });

      // Keep date & sourceDestination for convenience, reset quantity & notes
      setQuantity(1);
      setNotes('');

      // Focus back to product selector or quantity
      setTimeout(() => {
        if (productSelectRef.current) {
          productSelectRef.current.focus();
        }
      }, 100);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default action on submit: for sales or multi-item, keep open to continue inputting
    processSave(false);
  };

  const isIncoming = type === 'IN';
  const isRetur = type === 'RETUR_OUT';
  const isPenjualan = type === 'OUT';

  const currentRealStock = selectedProd ? getRealStock(selectedProd, transactions) : 0;
  const projectedStock = isIncoming
    ? currentRealStock + Number(quantity || 0)
    : Math.max(0, currentRealStock - Number(quantity || 0));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-[24px] max-w-xl w-full p-6 md:p-8 shadow-2xl border border-[#c4c5d5]/40 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-[#c4c5d5]/30">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[20px] font-bold text-[#1a1b22]">
                {isIncoming && 'Catat Barang Masuk'}
                {isPenjualan && 'Catat Penjualan'}
                {isRetur && 'Catat Barang Retur (ke Supplier)'}
              </h3>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isIncoming
                    ? 'bg-[#6cf8bb]/20 text-[#00714d] border border-[#6cf8bb]/40'
                    : isPenjualan
                    ? 'bg-[#dde1ff] text-[#00288e] border border-[#00288e]/20'
                    : 'bg-[#ffdad6] text-[#93000a] border border-[#ffdad6]'
                }`}
              >
                {isIncoming && '+ Masuk Gudang'}
                {isPenjualan && '- Penjualan'}
                {isRetur && '- Retur Supplier'}
              </span>

              {sessionSavedItems.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f0fdf4] text-[#00714d] border border-[#bbf7d0] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  <span>{sessionSavedItems.length} Item Tersimpan</span>
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#444653] mt-0.5">
              {isIncoming && 'Pencatatan pasokan stok baru yang diterima dari pemasok (menambah stok).'}
              {isPenjualan && 'Pencatatan transaksi penjualan. Klik "Simpan & Lanjut" untuk input item berikutnya secara beruntun.'}
              {isRetur && 'Pengembalian barang rusak, reject, atau expired khusus kepada supplier (mengurangi stok).'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#757684] hover:bg-[#e8e7f1] transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Live Success Banner when an item was just recorded */}
        {successBanner && (
          <div className="mt-4 p-3.5 bg-[#f0fdf4] border border-[#6cf8bb] rounded-xl flex items-start justify-between gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#006c49] text-white flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[16px]">check</span>
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#006c49]">
                  {successBanner.message}: {successBanner.quantity} {successBanner.unit} {successBanner.productName}
                </p>
                <p className="text-[11px] text-[#00714d] mt-0.5">
                  ✓ Data telah tersimpan ke database & stok otomatis terpotong. Silakan pilih produk berikutnya di bawah ini.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="text-[#00714d] hover:text-[#005237] text-[18px] p-0.5"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4 mt-4">
          {/* Mode Switcher Buttons */}
          <div>
            <label className="block text-[12px] font-bold text-[#444653] mb-1.5">
              Jenis Transaksi Mutasi
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Option 1: Barang Masuk */}
              <button
                type="button"
                onClick={() => handleTypeChange('IN')}
                className={`py-2.5 px-2 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-1.5 font-bold text-[12px] transition-all cursor-pointer ${
                  type === 'IN'
                    ? 'bg-[#006c49] text-white border-[#006c49] shadow-sm'
                    : 'bg-white text-[#444653] border-[#c4c5d5] hover:bg-[#f4f2fc]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                <span>Barang Masuk</span>
              </button>

              {/* Option 2: Penjualan */}
              <button
                type="button"
                onClick={() => handleTypeChange('OUT')}
                className={`py-2.5 px-2 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-1.5 font-bold text-[12px] transition-all cursor-pointer ${
                  type === 'OUT'
                    ? 'bg-[#00288e] text-white border-[#00288e] shadow-sm'
                    : 'bg-white text-[#444653] border-[#c4c5d5] hover:bg-[#f4f2fc]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                <span>Penjualan</span>
              </button>

              {/* Option 3: Barang Retur (ke Supplier) */}
              <button
                type="button"
                onClick={() => handleTypeChange('RETUR_OUT')}
                className={`py-2.5 px-2 rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-1.5 font-bold text-[12px] transition-all cursor-pointer ${
                  type === 'RETUR_OUT'
                    ? 'bg-[#ba1a1a] text-white border-[#ba1a1a] shadow-sm'
                    : 'bg-white text-[#ba1a1a] border-[#ba1a1a]/40 hover:bg-[#ffdad6]/30'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">reply_all</span>
                <span>Retur Supplier</span>
              </button>
            </div>
          </div>

          {/* Tanggal Transaksi Input */}
          <div className="bg-[#fbf8ff] p-3.5 rounded-xl border border-[#c4c5d5]/60">
            <label className="block text-[12px] font-bold text-[#1a1b22] mb-1.5 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#00288e]">calendar_today</span>
              <span>Tanggal Transaksi</span>
              <span className="text-[#ba1a1a] font-bold">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-[#c4c5d5] rounded-xl text-[14px] bg-white text-[#1a1b22] font-semibold focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] outline-none cursor-pointer"
              required
            />
            <p className="text-[11px] text-[#757684] mt-1">
              Tanggal transaksi akan otomatis dipertahankan saat Anda menginput beberapa item berturut-turut.
            </p>
          </div>

          {/* Product Selection */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[12px] font-bold text-[#444653]">
                Pilih Produk
                <span className="text-[#ba1a1a] font-bold ml-0.5">*</span>
              </label>
              {selectedProd && (
                <span className="text-[11px] font-semibold text-[#00288e] bg-[#dde1ff]/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">store</span>
                  Supplier: {selectedProd.supplier || 'Adda Rasa'}
                </span>
              )}
            </div>
            <select
              ref={productSelectRef}
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-[#c4c5d5] rounded-xl text-[14px] bg-[#fbf8ff] focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] outline-none cursor-pointer font-medium"
            >
              {products.map((p) => {
                const realStock = getRealStock(p, transactions);
                return (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name} | Stok: {realStock} {p.unit} ({p.supplier || 'Supplier Utama'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Quantity & Source / Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-[#444653] mb-1">
                Kuantitas {isIncoming ? 'Masuk' : isPenjualan ? 'Terjual' : 'Retur'} ({selectedProd?.unit || 'Unit'})
                <span className="text-[#ba1a1a] font-bold ml-0.5">*</span>
              </label>
              <input
                ref={quantityInputRef}
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full px-3.5 py-2.5 border border-[#c4c5d5] rounded-xl text-[14px] font-mono font-bold bg-[#fbf8ff] focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#444653] mb-1">
                {isIncoming && 'Supplier / Pemasok'}
                {isPenjualan && 'Tujuan Konsumen / Outlet'}
                {isRetur && 'Pemasok / Supplier Penerima Retur'}
                <span className="text-[#ba1a1a] font-bold ml-0.5">*</span>
              </label>
              {isIncoming || isRetur ? (
                <div className="relative">
                  <input
                    type="text"
                    list="supplier-options"
                    value={sourceDestination}
                    onChange={(e) => {
                      setSourceDestination(e.target.value);
                      setSelectedSupplier(e.target.value);
                    }}
                    placeholder="Pilih atau ketik nama supplier..."
                    className="w-full px-3.5 py-2.5 border border-[#c4c5d5] rounded-xl text-[14px] bg-[#fbf8ff] focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] outline-none"
                    required
                  />
                  <datalist id="supplier-options">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                    {selectedProd?.supplier && (
                      <option value={selectedProd.supplier} />
                    )}
                  </datalist>
                </div>
              ) : (
                <input
                  type="text"
                  value={sourceDestination}
                  onChange={(e) => setSourceDestination(e.target.value)}
                  placeholder="Contoh: Konsumen / Outlet / Meja 04"
                  className="w-full px-3.5 py-2.5 border border-[#c4c5d5] rounded-xl text-[14px] bg-[#fbf8ff] focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] outline-none"
                  required
                />
              )}
            </div>
          </div>

          {/* Specific section for Retur to Supplier */}
          {isRetur && (
            <div className="p-4 bg-[#fff8f7] rounded-xl border border-[#ffdad6] space-y-2">
              <label className="block text-[12px] font-bold text-[#93000a] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[17px] text-[#ba1a1a]">report_problem</span>
                <span>Alasan Retur ke Supplier</span>
                <span className="text-[#ba1a1a] font-bold">*</span>
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[#ffdad6] rounded-xl text-[13px] bg-white font-medium focus:ring-2 focus:ring-[#ba1a1a]/20 focus:border-[#ba1a1a] outline-none cursor-pointer"
              >
                {SUPPLIER_RETUR_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#757684]">
                Barang akan dikembalikan kepada supplier <strong>{selectedProd?.supplier || sourceDestination}</strong> dan otomatis mengurangi stok fisik gudang.
              </p>
            </div>
          )}

          {/* Notes / Document Reference */}
          <div>
            <label className="block text-[12px] font-bold text-[#444653] mb-1">
              {isIncoming && 'No. Surat Jalan / No. PO / Catatan'}
              {isPenjualan && 'No. Invoice / Nota Penjualan / Catatan'}
              {isRetur && 'No. Berita Acara Retur / Keterangan Tambahan'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isIncoming
                  ? 'Contoh: SJ/2026/09/001 - Kiriman Batch Pagi'
                  : isPenjualan
                  ? 'Contoh: INV-88231 / Meja 05'
                  : 'Contoh: Berita Acara Retur No. BAR-091'
              }
              className="w-full px-3.5 py-2.5 border border-[#c4c5d5] rounded-xl text-[14px] bg-[#fbf8ff] focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] outline-none"
            />
          </div>

          {/* Projected Stock Preview */}
          {selectedProd && (
            <div
              className={`p-3.5 rounded-xl border text-[12px] flex items-center justify-between ${
                !isIncoming && projectedStock <= selectedProd.minStock
                  ? 'bg-[#fff8f7] border-[#ffdad6] text-[#ba1a1a]'
                  : isIncoming
                  ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]'
                  : 'bg-[#f4f2fc] border-[#c4c5d5]/40 text-[#444653]'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                <span className="material-symbols-outlined text-[18px]">
                  {!isIncoming && projectedStock <= selectedProd.minStock ? 'warning' : 'inventory'}
                </span>
                <div>
                  <span>
                    Stok saat ini: <strong className="font-mono">{currentRealStock}</strong> {selectedProd.unit}
                    {' '}{isIncoming ? '+' : '-'} <strong className="font-mono">{quantity}</strong> {selectedProd.unit}
                    {' → '} Estimasi Akhir:{' '}
                    <strong className="font-mono font-bold">{projectedStock} {selectedProd.unit}</strong>
                  </span>
                </div>
              </div>
              <div>
                {!isIncoming && projectedStock <= selectedProd.minStock && (
                  <span className="font-bold px-2 py-0.5 rounded bg-[#ba1a1a] text-white text-[10px]">
                    ⚠️ Stok Menipis
                  </span>
                )}
                {isIncoming && (
                  <span className="font-bold px-2 py-0.5 rounded bg-[#166534] text-white text-[10px]">
                    + Menambah
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Session History (List of items entered during this session) */}
          {sessionSavedItems.length > 0 && (
            <div className="bg-[#f4f2fc] p-3.5 rounded-xl border border-[#c4c5d5]/40 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#444653] uppercase">
                <span>Rincian Item yang Baru Diinput ({sessionSavedItems.length})</span>
                <span className="text-[#006c49]">Tersimpan</span>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 divide-y divide-[#c4c5d5]/20">
                {sessionSavedItems.map((item, idx) => (
                  <div key={item.id || idx} className="pt-1 first:pt-0 flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold text-[#00288e] text-[11px]">{item.code}</span>
                      <span className="text-[#1a1b22] font-medium">{item.productName}</span>
                    </div>
                    <div className="font-mono font-bold text-[#00288e]">
                      {item.type === 'IN' ? '+' : '-'}{item.quantity} {item.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons: Designed for continuous input workflow */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#c4c5d5]/30">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 border border-[#c4c5d5] rounded-xl text-[13px] font-bold text-[#444653] hover:bg-[#f4f2fc] transition-colors cursor-pointer order-3 sm:order-1"
            >
              {sessionSavedItems.length > 0 ? `Selesai (${sessionSavedItems.length} Item)` : 'Batal / Tutup'}
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2">
              {/* Secondary: Simpan & Tutup */}
              <button
                type="button"
                onClick={() => processSave(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 border border-[#c4c5d5] bg-white text-[#1a1b22] hover:bg-[#f4f2fc] rounded-xl text-[13px] font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                title="Simpan transaksi saat ini dan langsung tutup formulir"
              >
                <span className="material-symbols-outlined text-[16px] text-[#757684]">done_all</span>
                <span>Simpan & Selesai</span>
              </button>

              {/* Primary: Simpan & Lanjut Input (Keeps modal open) */}
              <button
                id="btn-simpan-lanjut-penjualan"
                type="submit"
                className={`flex-1 sm:flex-none px-5 py-2.5 text-white rounded-xl text-[13px] font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 ${
                  isIncoming
                    ? 'bg-[#006c49] hover:bg-[#005237]'
                    : isPenjualan
                    ? 'bg-[#00288e] hover:bg-[#1e40af]'
                    : 'bg-[#ba1a1a] hover:bg-[#93000a]'
                }`}
                title="Simpan transaksi ini dan tetap di formulir untuk input item selanjutnya"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isPenjualan ? 'add_shopping_cart' : 'add_circle'}
                </span>
                <span>
                  {isIncoming && 'Simpan & Lanjut Input Masuk'}
                  {isPenjualan && 'Simpan & Lanjut Input Penjualan'}
                  {isRetur && 'Simpan & Lanjut Retur'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
