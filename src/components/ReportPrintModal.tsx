import React, { useState, useEffect, useRef } from 'react';
import { Product, Supplier, Transaction, ReportFilter, User } from '../types';
import { AddaRasaLogo } from './AddaRasaLogo';
import { getProductStockSummary, calculateInventoryMetrics } from '../utils/stockCalculator';
import { printElement, exportElementToPdf, downloadDocumentAsHtml, openDocumentInNewTab } from '../utils/printHelper';

interface ReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  suppliers: Supplier[];
  transactions?: Transaction[];
  reportFilter: ReportFilter;
  currentUser?: User;
  initialReportType?: 'inventory' | 'incoming' | 'sales' | 'returns';
}

export const ReportPrintModal: React.FC<ReportPrintModalProps> = ({
  isOpen,
  onClose,
  products,
  suppliers,
  transactions = [],
  reportFilter,
  currentUser,
  initialReportType = 'inventory',
}) => {
  const [reportType, setReportType] = useState<'inventory' | 'incoming' | 'sales' | 'returns'>(initialReportType);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfStatusMessage, setPdfStatusMessage] = useState<string>('');
  const printableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setReportType(initialReportType);
      setIsGeneratingPdf(false);
      setPdfStatusMessage('');
    }
  }, [isOpen, initialReportType]);

  if (!isOpen) return null;

  // Helper product lookup map
  const productMap = new Map<string, Product>();
  products.forEach((p) => {
    if (p.id) productMap.set(p.id, p);
    if (p.code) productMap.set(p.code.toLowerCase(), p);
    if (p.name) productMap.set(p.name.toLowerCase(), p);
  });

  const getProductForTx = (t: Transaction): Product | undefined => {
    return (
      (t.productId ? productMap.get(t.productId) : undefined) ||
      (t.productCode ? productMap.get(t.productCode.toLowerCase()) : undefined) ||
      (t.productName ? productMap.get(t.productName.toLowerCase()) : undefined)
    );
  };

  // Helper to resolve genuine supplier name
  const resolveSupplier = (t: Transaction): string => {
    const matched = getProductForTx(t);
    if (matched?.supplier && matched.supplier.trim() !== '') {
      return matched.supplier;
    }
    if (t.supplier && t.supplier.trim() !== '') {
      return t.supplier;
    }
    // If incoming and sourceDestination looks like a supplier (doesn't contain "Outlet" or "Meja" or "Konsumen")
    if (t.type === 'IN' && t.sourceDestination) {
      return t.sourceDestination;
    }
    if (suppliers.length > 0) {
      return suppliers[0].name;
    }
    return '-';
  };

  // Helper to resolve price
  const resolvePrice = (t: Transaction): number => {
    const matched = getProductForTx(t);
    return matched?.price || t.price || 0;
  };

  // Filter products according to reportFilter
  const filteredProducts = products.filter((p) => {
    if (
      reportFilter.supplier &&
      reportFilter.supplier !== 'Semua Supplier' &&
      p.supplier !== reportFilter.supplier
    ) {
      return false;
    }
    if (
      reportFilter.category &&
      reportFilter.category !== 'Semua Kategori' &&
      p.category !== reportFilter.category
    ) {
      return false;
    }
    return true;
  });

  // Filter Transactions by month/dates if needed
  const filterTransactionByPeriod = (t: Transaction) => {
    if (reportFilter.startDate && reportFilter.endDate) {
      if (t.date < reportFilter.startDate || t.date > reportFilter.endDate) {
        return false;
      }
    }
    return true;
  };

  // Incoming Transactions (Barang Masuk)
  const incomingTransactions = transactions
    .filter((t) => t.type === 'IN')
    .filter(filterTransactionByPeriod);

  // Outbound / Sales Transactions
  const outboundTransactions = transactions
    .filter((t) => t.type === 'OUT')
    .filter(filterTransactionByPeriod);

  // Return Transactions
  const returnTransactions = transactions
    .filter((t) => t.type === 'RETUR_IN' || t.type === 'RETUR_OUT')
    .filter(filterTransactionByPeriod);

  // Metrics for Inventory
  const { totalStock, totalHealthy, totalLow, totalOut, totalIn, totalOutUnits } =
    calculateInventoryMetrics(filteredProducts, transactions);

  const totalInventoryValuation = filteredProducts.reduce((acc, p) => {
    const summary = getProductStockSummary(p, transactions);
    return acc + summary.currentStock * (p.price || 0);
  }, 0);

  // Metrics for Incoming
  const totalIncomingQty = incomingTransactions.reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
  const totalIncomingValuation = incomingTransactions.reduce((acc, t) => {
    const price = resolvePrice(t);
    return acc + t.quantity * price;
  }, 0);

  // Metrics for Sales
  const totalSalesRevenue = outboundTransactions.reduce((acc, t) => {
    const price = resolvePrice(t);
    return acc + t.quantity * price;
  }, 0);

  const totalSalesQty = outboundTransactions.reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);

  // Metrics for Returns
  const totalReturInQty = returnTransactions
    .filter((t) => t.type === 'RETUR_IN')
    .reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);

  const totalReturOutQty = returnTransactions
    .filter((t) => t.type === 'RETUR_OUT')
    .reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);

  const totalReturValuation = returnTransactions.reduce((acc, t) => {
    const price = resolvePrice(t);
    return acc + t.quantity * price;
  }, 0);

  const getDocTitle = () => {
    const period = (reportFilter.month || 'Semua_Periode').replace(/\s+/g, '_');
    switch (reportType) {
      case 'inventory':
        return `Laporan_Stok_Inventaris_ADDA_RASA_${period}`;
      case 'incoming':
        return `Laporan_Barang_Masuk_ADDA_RASA_${period}`;
      case 'sales':
        return `Laporan_Penjualan_ADDA_RASA_${period}`;
      case 'returns':
        return `Laporan_Retur_Barang_ADDA_RASA_${period}`;
    }
  };

  const getReportNameText = () => {
    switch (reportType) {
      case 'inventory':
        return 'Laporan Rekapitulasi Stok & Inventaris';
      case 'incoming':
        return 'Laporan Rekapitulasi Penerimaan Barang Masuk';
      case 'sales':
        return 'Laporan Rekapitulasi Penjualan & Pengeluaran Barang';
      case 'returns':
        return 'Laporan Rekapitulasi Retur Barang (Masuk & Keluar)';
    }
  };

  const handleExportDirectPdf = async () => {
    if (!printableRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    const docTitle = getDocTitle();
    try {
      await exportElementToPdf(printableRef.current, `${docTitle}.pdf`, (msg) => {
        setPdfStatusMessage(msg);
      });
    } catch (err) {
      console.error('Failed to export PDF', err);
      setPdfStatusMessage('Gagal membuat PDF. Coba cetak ke printer.');
    } finally {
      setTimeout(() => {
        setIsGeneratingPdf(false);
        setPdfStatusMessage('');
      }, 1500);
    }
  };

  const handlePrint = () => {
    const docTitle = getDocTitle();
    printElement(printableRef.current, docTitle);
  };

  const handleDownloadHtml = () => {
    if (!printableRef.current) return;
    const docTitle = getDocTitle();
    downloadDocumentAsHtml(
      printableRef.current.innerHTML,
      `${docTitle}.html`,
      getReportNameText()
    );
  };

  const handleOpenNewTab = () => {
    if (!printableRef.current) return;
    const docTitle = getDocTitle();
    openDocumentInNewTab(
      printableRef.current.innerHTML,
      `${getReportNameText()} - ADDA RASA KJD`
    );
  };

  const currentDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const docCodePrefix =
    reportType === 'inventory'
      ? 'STK'
      : reportType === 'incoming'
      ? 'IN'
      : reportType === 'sales'
      ? 'SLS'
      : 'RTR';

  const docNumber = `DOC/${docCodePrefix}/${new Date().getFullYear()}/${String(
    new Date().getMonth() + 1
  ).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-[#c4c5d5]/40 overflow-hidden">
        {/* Modal Top Header */}
        <div className="p-4 md:p-5 border-b border-[#c4c5d5]/30 bg-[#fbf8ff] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00288e]/10 text-[#00288e] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">picture_as_pdf</span>
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-[#1a1b22] leading-tight">
                Pratinjau & Cetak / Simpan PDF
              </h3>
              <p className="text-[12px] text-[#444653]">
                Format dokumen siap cetak resmi A4 dengan kop surat & logo ADDA RASA.
              </p>
            </div>
          </div>

          {/* Type Switcher & Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center p-1 bg-[#f4f2fc] rounded-xl border border-[#c4c5d5]/40 flex-wrap">
              <button
                type="button"
                onClick={() => setReportType('inventory')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  reportType === 'inventory'
                    ? 'bg-white text-[#00288e] shadow-xs'
                    : 'text-[#757684] hover:text-[#1a1b22]'
                }`}
              >
                Stok Inventaris
              </button>
              <button
                type="button"
                onClick={() => setReportType('incoming')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  reportType === 'incoming'
                    ? 'bg-white text-[#006c49] shadow-xs'
                    : 'text-[#757684] hover:text-[#1a1b22]'
                }`}
              >
                Barang Masuk
              </button>
              <button
                type="button"
                onClick={() => setReportType('sales')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  reportType === 'sales'
                    ? 'bg-white text-[#00288e] shadow-xs'
                    : 'text-[#757684] hover:text-[#1a1b22]'
                }`}
              >
                Penjualan (Keluar)
              </button>
              <button
                type="button"
                onClick={() => setReportType('returns')}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  reportType === 'returns'
                    ? 'bg-white text-[#006874] shadow-xs'
                    : 'text-[#757684] hover:text-[#1a1b22]'
                }`}
              >
                Retur Barang
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="hidden md:flex items-center gap-1 bg-[#f4f2fc] p-1 rounded-xl border border-[#c4c5d5]/40">
              <button
                onClick={() => setZoomLevel((z) => Math.max(60, z - 10))}
                className="p-1 rounded text-[#444653] hover:bg-white cursor-pointer"
                title="Perkecil"
              >
                <span className="material-symbols-outlined text-[16px]">remove</span>
              </button>
              <span className="text-[11px] font-mono font-bold px-1 text-[#1a1b22]">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
                className="p-1 rounded text-[#444653] hover:bg-white cursor-pointer"
                title="Perbesar"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#757684] hover:bg-[#e8e7f1] transition-colors cursor-pointer ml-1"
              title="Tutup Modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable Document Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#8e9099]/15 flex justify-center">
          <div
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            className="w-full max-w-[840px] transition-transform duration-150"
          >
            {/* Printable Document Box (A4 Style) */}
            <div
              ref={printableRef}
              className="bg-white p-6 sm:p-8 md:p-10 rounded-xl shadow-lg border border-[#c4c5d5]/50 space-y-6 text-[#1a1b22]"
            >
              {/* Kop Surat Resmi ADDA RASA KJD */}
              <div className="border-b-2 border-[#00288e] pb-4 flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-20 shrink-0 flex items-center justify-center">
                    <AddaRasaLogo size="md" width={64} height={80} showText={true} theme="gold" />
                  </div>
                  <div>
                    <h1 className="text-[22px] font-black text-[#00288e] tracking-tight">
                      ADDA RASA KJD
                    </h1>
                    <p className="text-[11px] text-[#444653] mt-1 leading-tight">
                      Adda Rasa KJD Kompleks Alvita Blok Q Nomor 14, Kelurahan Sawah Lama, Kecamatan Ciputat, Kota Tangerang Selatan, Banten
                    </p>
                    <p className="text-[11px] text-[#757684]">
                      Telp/WA: +62 812-3456-7890 | Email: addarasakjd@gmail.com
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 border-l border-[#c4c5d5]/50 pl-5 hidden sm:block">
                  <span className="text-[10px] font-bold text-[#757684] uppercase block">
                    Dokumen Resmi
                  </span>
                  <span className="text-[12px] font-mono font-bold text-[#1a1b22] block">
                    {docNumber}
                  </span>
                  <span className="text-[11px] text-[#444653] block mt-1">
                    Dicetak: {currentDateFormatted}
                  </span>
                </div>
              </div>

              {/* Title & Filter Metadata Box */}
              <div className="bg-[#f4f2fc]/80 p-4 rounded-xl border border-[#c4c5d5]/50 space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h2 className="text-[16px] font-bold text-[#00288e] uppercase tracking-wide">
                      {getReportNameText()}
                    </h2>
                    <p className="text-[12px] text-[#444653]">
                      Status data real-time per tanggal: <strong>{currentDateFormatted}</strong>
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] font-bold text-[#757684] uppercase block">
                      Periode Laporan
                    </span>
                    <span className="text-[13px] font-semibold text-[#1a1b22]">
                      {reportFilter.month} {reportFilter.startDate && reportFilter.endDate ? `(${reportFilter.startDate} s/d ${reportFilter.endDate})` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#c4c5d5]/30 text-[12px]">
                  <div className="px-2.5 py-1 bg-white rounded-lg border border-[#c4c5d5]/40 text-[#444653]">
                    Supplier:{' '}
                    <strong className="text-[#1a1b22]">{reportFilter.supplier}</strong>
                  </div>
                  <div className="px-2.5 py-1 bg-white rounded-lg border border-[#c4c5d5]/40 text-[#444653]">
                    Kategori:{' '}
                    <strong className="text-[#1a1b22]">
                      {reportFilter.category || 'Semua Kategori'}
                    </strong>
                  </div>
                  <div className="px-2.5 py-1 bg-white rounded-lg border border-[#c4c5d5]/40 text-[#444653]">
                    Total Item:{' '}
                    <strong className="text-[#1a1b22]">
                      {reportType === 'inventory'
                        ? `${filteredProducts.length} SKU`
                        : reportType === 'incoming'
                        ? `${incomingTransactions.length} Transaksi`
                        : reportType === 'sales'
                        ? `${outboundTransactions.length} Transaksi`
                        : `${returnTransactions.length} Transaksi`}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Executive Summary Metrics Box */}
              {reportType === 'inventory' ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#757684] uppercase block">
                      Real Stok Fisik
                    </span>
                    <span className="text-[18px] font-bold text-[#00288e] font-mono">
                      {totalStock.toLocaleString('id-ID')} unit
                    </span>
                  </div>
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#006c49] uppercase block">
                      Mutasi Masuk (+)
                    </span>
                    <span className="text-[18px] font-bold text-[#006c49] font-mono">
                      +{totalIn.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#ba1a1a] uppercase block">
                      Mutasi Keluar (-)
                    </span>
                    <span className="text-[18px] font-bold text-[#ba1a1a] font-mono">
                      -{totalOutUnits.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#00288e] uppercase block">
                      Valuasi Nilai Stok
                    </span>
                    <span className="text-[16px] font-bold text-[#00288e] font-mono">
                      Rp {totalInventoryValuation.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ) : reportType === 'incoming' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#757684] uppercase block">
                      Total Transaksi Masuk
                    </span>
                    <span className="text-[18px] font-bold text-[#1a1b22] font-mono">
                      {incomingTransactions.length} Log
                    </span>
                  </div>
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#006c49] uppercase block">
                      Total Unit Diterima
                    </span>
                    <span className="text-[18px] font-bold text-[#006c49] font-mono">
                      +{totalIncomingQty.toLocaleString('id-ID')} unit
                    </span>
                  </div>
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#00288e] uppercase block">
                      Total Nilai Pengadaan
                    </span>
                    <span className="text-[18px] font-bold text-[#00288e] font-mono">
                      Rp {totalIncomingValuation.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ) : reportType === 'sales' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#757684] uppercase block">
                      Total Transaksi Keluar
                    </span>
                    <span className="text-[18px] font-bold text-[#1a1b22] font-mono">
                      {outboundTransactions.length} Log
                    </span>
                  </div>
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#006c49] uppercase block">
                      Total Unit Terjual
                    </span>
                    <span className="text-[18px] font-bold text-[#006c49] font-mono">
                      {totalSalesQty.toLocaleString('id-ID')} unit
                    </span>
                  </div>
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#00288e] uppercase block">
                      Estimasi Total Omset
                    </span>
                    <span className="text-[18px] font-bold text-[#00288e] font-mono">
                      Rp {totalSalesRevenue.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#757684] uppercase block">
                      Total Transaksi Retur
                    </span>
                    <span className="text-[18px] font-bold text-[#1a1b22] font-mono">
                      {returnTransactions.length} Log
                    </span>
                  </div>
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#006874] uppercase block">
                      Retur Masuk (+Outlet)
                    </span>
                    <span className="text-[18px] font-bold text-[#006874] font-mono">
                      +{totalReturInQty.toLocaleString('id-ID')} unit
                    </span>
                  </div>
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#9a4500] uppercase block">
                      Retur Keluar (-Supplier)
                    </span>
                    <span className="text-[18px] font-bold text-[#9a4500] font-mono">
                      -{totalReturOutQty.toLocaleString('id-ID')} unit
                    </span>
                  </div>
                  <div className="p-3 bg-[#fbf8ff] rounded-xl border border-[#c4c5d5]/40">
                    <span className="text-[10px] font-bold text-[#00288e] uppercase block">
                      Estimasi Nilai Retur
                    </span>
                    <span className="text-[16px] font-bold text-[#00288e] font-mono">
                      Rp {totalReturValuation.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="overflow-x-auto">
                {reportType === 'inventory' ? (
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#eeedf7] border-y-2 border-[#00288e]/30">
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">No</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Kode</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Nama Produk</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Kategori</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Supplier</th>
                        <th className="py-2.5 px-2 font-bold text-[#757684] text-right">Awal</th>
                        <th className="py-2.5 px-2 font-bold text-[#006c49] text-right">In(+)</th>
                        <th className="py-2.5 px-2 font-bold text-[#ba1a1a] text-right">Out(-)</th>
                        <th className="py-2.5 px-2 font-bold text-[#00288e] text-right bg-[#00288e]/5">
                          Real Stok
                        </th>
                        <th className="py-2.5 px-2 font-bold text-[#444653] text-right">Harga</th>
                        <th className="py-2.5 px-2 font-bold text-[#00288e] text-right">
                          Valuasi (Rp)
                        </th>
                        <th className="py-2.5 px-2 font-bold text-[#444653] text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c4c5d5]/30">
                      {filteredProducts.map((p, idx) => {
                        const summary = getProductStockSummary(p, transactions);
                        const valuation = summary.currentStock * (p.price || 0);

                        return (
                          <tr key={p.id} className="hover:bg-[#f4f2fc]/30">
                            <td className="py-2 px-2 text-center text-[#757684] font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-2 font-mono font-semibold text-[#00288e]">
                              {p.code}
                            </td>
                            <td className="py-2 px-2 font-semibold">{p.name}</td>
                            <td className="py-2 px-2 text-[#444653]">{p.category}</td>
                            <td className="py-2 px-2 text-[#444653]">{p.supplier}</td>
                            <td className="py-2 px-2 text-right font-mono text-[#757684]">
                              {summary.initialStock}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-[#006c49]">
                              {summary.totalIn > 0 ? `+${summary.totalIn}` : '0'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-[#ba1a1a]">
                              {summary.totalOut > 0 ? `-${summary.totalOut}` : '0'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-[#00288e] bg-[#00288e]/5">
                              {summary.currentStock} {p.unit}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-[#444653]">
                              Rp {(p.price || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-[#00288e]">
                              Rp {valuation.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {summary.health === 'Aman' && (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6cf8bb]/30 text-[#00714d]">
                                  Aman
                                </span>
                              )}
                              {summary.health === 'Menipis' && (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6b4200]/10 text-[#4c2e00]">
                                  Menipis
                                </span>
                              )}
                              {summary.health === 'Habis' && (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ffdad6] text-[#93000a]">
                                  Habis
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#1a1b22] font-bold bg-[#f4f2fc] text-[11px]">
                        <td colSpan={5} className="py-2.5 px-2 text-right uppercase">
                          Total Ringkasan:
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono"></td>
                        <td className="py-2.5 px-2 text-right font-mono text-[#006c49]">
                          +{totalIn}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-[#ba1a1a]">
                          -{totalOutUnits}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-[#00288e] bg-[#00288e]/10">
                          {totalStock.toLocaleString('id-ID')} unit
                        </td>
                        <td></td>
                        <td className="py-2.5 px-2 text-right font-mono text-[#00288e]">
                          Rp {totalInventoryValuation.toLocaleString('id-ID')}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                ) : reportType === 'incoming' ? (
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#eeedf7] border-y-2 border-[#006c49]/30">
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">No</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Tgl</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">No. Transaksi</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Nama Produk</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Supplier</th>
                        <th className="py-2.5 px-2 font-bold text-[#006c49] text-right">Qty</th>
                        <th className="py-2.5 px-2 font-bold text-[#444653] text-right">
                          Harga (Rp)
                        </th>
                        <th className="py-2.5 px-2 font-bold text-[#00288e] text-right">
                          Total (Rp)
                        </th>
                        <th className="py-2.5 px-2 font-bold text-[#444653]">
                          No. Surat Jalan / Keterangan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c4c5d5]/30">
                      {incomingTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-[#757684] italic">
                            Belum ada transaksi barang masuk pada periode ini.
                          </td>
                        </tr>
                      ) : (
                        incomingTransactions.map((t, idx) => {
                          const supplierName = resolveSupplier(t);
                          const price = resolvePrice(t);
                          const subtotal = t.quantity * price;

                          return (
                            <tr key={t.id} className="hover:bg-[#f4f2fc]/30">
                              <td className="py-2 px-2 text-center text-[#757684] font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-2 font-mono whitespace-nowrap">{t.date}</td>
                              <td className="py-2 px-2 font-mono font-semibold text-[#00288e]">
                                {t.code}
                              </td>
                              <td className="py-2 px-2 font-semibold">
                                {t.productName}
                                <span className="block text-[10px] text-[#757684] font-mono">
                                  {t.productCode}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-[#1a1b22] font-medium">{supplierName}</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-[#006c49]">
                                +{t.quantity} {t.unit}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-[#444653]">
                                Rp {price.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-[#00288e]">
                                Rp {subtotal.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2 text-[#444653]">
                                {t.notes || t.sourceDestination || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#1a1b22] font-bold bg-[#f4f2fc] text-[11px]">
                        <td colSpan={5} className="py-2.5 px-2 text-right uppercase">
                          Total Barang Masuk:
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-[#006c49]">
                          +{totalIncomingQty.toLocaleString('id-ID')}
                        </td>
                        <td></td>
                        <td className="py-2.5 px-2 text-right font-mono text-[#00288e]">
                          Rp {totalIncomingValuation.toLocaleString('id-ID')}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                ) : reportType === 'sales' ? (
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#eeedf7] border-y-2 border-[#00288e]/30">
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">No</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Tgl</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">No. Transaksi</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Nama Produk</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Supplier</th>
                        <th className="py-2.5 px-2 font-bold text-[#ba1a1a] text-right">Qty</th>
                        <th className="py-2.5 px-2 font-bold text-[#444653] text-right">
                          Harga (Rp)
                        </th>
                        <th className="py-2.5 px-2 font-bold text-[#00288e] text-right">
                          Total (Rp)
                        </th>
                        <th className="py-2.5 px-2 font-bold text-[#444653]">Tujuan / Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c4c5d5]/30">
                      {outboundTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-[#757684] italic">
                            Belum ada transaksi penjualan pada periode ini.
                          </td>
                        </tr>
                      ) : (
                        outboundTransactions.map((t, idx) => {
                          const supplierName = resolveSupplier(t);
                          const price = resolvePrice(t);
                          const subtotal = t.quantity * price;

                          return (
                            <tr key={t.id} className="hover:bg-[#f4f2fc]/30">
                              <td className="py-2 px-2 text-center text-[#757684] font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-2 font-mono whitespace-nowrap">{t.date}</td>
                              <td className="py-2 px-2 font-mono font-semibold text-[#00288e]">
                                {t.code}
                              </td>
                              <td className="py-2 px-2 font-semibold">
                                {t.productName}
                                <span className="block text-[10px] text-[#757684] font-mono">
                                  {t.productCode}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-[#1a1b22] font-medium">{supplierName}</td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-[#ba1a1a]">
                                {t.quantity} {t.unit}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-[#444653]">
                                Rp {price.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-[#00288e]">
                                Rp {subtotal.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2 text-[#444653]">
                                {t.sourceDestination} {t.notes ? `(${t.notes})` : ''}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#1a1b22] font-bold bg-[#f4f2fc] text-[11px]">
                        <td colSpan={5} className="py-2.5 px-2 text-right uppercase">
                          Total Penjualan:
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-[#ba1a1a]">
                          {totalSalesQty.toLocaleString('id-ID')}
                        </td>
                        <td></td>
                        <td className="py-2.5 px-2 text-right font-mono text-[#00288e]">
                          Rp {totalSalesRevenue.toLocaleString('id-ID')}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#eeedf7] border-y-2 border-[#006874]/30">
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">No</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Tgl</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">No. Transaksi</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Nama Produk</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Supplier</th>
                        <th className="py-2.5 px-2 font-bold text-[#1a1b22]">Jenis Retur</th>
                        <th className="py-2.5 px-2 font-bold text-right">Qty</th>
                        <th className="py-2.5 px-2 font-bold text-[#444653] text-right">
                          Harga (Rp)
                        </th>
                        <th className="py-2.5 px-2 font-bold text-[#00288e] text-right">
                          Total (Rp)
                        </th>
                        <th className="py-2.5 px-2 font-bold text-[#444653]">
                          Alasan Retur / Catatan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c4c5d5]/30">
                      {returnTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-6 text-center text-[#757684] italic">
                            Belum ada data transaksi retur tercatat pada periode ini.
                          </td>
                        </tr>
                      ) : (
                        returnTransactions.map((t, idx) => {
                          const isReturIn = t.type === 'RETUR_IN';
                          const supplierName = resolveSupplier(t);
                          const price = resolvePrice(t);
                          const subtotal = t.quantity * price;

                          return (
                            <tr key={t.id} className="hover:bg-[#f4f2fc]/30">
                              <td className="py-2 px-2 text-center text-[#757684] font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-2 font-mono whitespace-nowrap">{t.date}</td>
                              <td className="py-2 px-2 font-mono font-semibold text-[#00288e]">
                                {t.code}
                              </td>
                              <td className="py-2 px-2 font-semibold">
                                {t.productName}
                                <span className="block text-[10px] text-[#757684] font-mono">
                                  {t.productCode}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-[#1a1b22] font-medium">{supplierName}</td>
                              <td className="py-2 px-2">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isReturIn
                                      ? 'bg-[#006874]/15 text-[#006874]'
                                      : 'bg-[#9a4500]/15 text-[#9a4500]'
                                  }`}
                                >
                                  {isReturIn ? 'RETUR MASUK (+)' : 'RETUR KELUAR (-)'}
                                </span>
                              </td>
                              <td
                                className={`py-2 px-2 text-right font-mono font-bold ${
                                  isReturIn ? 'text-[#006874]' : 'text-[#9a4500]'
                                }`}
                              >
                                {isReturIn ? `+${t.quantity}` : `-${t.quantity}`} {t.unit}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-[#444653]">
                                Rp {price.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-[#00288e]">
                                Rp {subtotal.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-2 text-[#444653]">
                                {t.returnReason || t.notes || t.sourceDestination || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#1a1b22] font-bold bg-[#f4f2fc] text-[11px]">
                        <td colSpan={6} className="py-2.5 px-2 text-right uppercase">
                          Total Ringkasan Retur:
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono">
                          <span className="text-[#006874] block">+{totalReturInQty} Masuk</span>
                          <span className="text-[#9a4500] block">-{totalReturOutQty} Keluar</span>
                        </td>
                        <td></td>
                        <td className="py-2.5 px-2 text-right font-mono text-[#00288e]">
                          Rp {totalReturValuation.toLocaleString('id-ID')}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Official Signature Section */}
              <div className="pt-8 grid grid-cols-2 gap-12 text-center text-[12px] text-[#1a1b22]">
                <div>
                  <p className="text-[#757684]">Dibuat & Disiapkan Oleh,</p>
                  <div className="h-16 flex items-end justify-center">
                    <span className="font-bold underline text-[#1a1b22]">
                      {currentUser?.name || 'Petugas Administrasi Gudang'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#757684]">Staff Inventaris & Keuangan</p>
                </div>

                <div>
                  <p className="text-[#757684]">Diperiksa & Disahkan Oleh,</p>
                  <div className="h-16 flex items-end justify-center">
                    <span className="font-bold underline text-[#1a1b22]">
                      ( .................................................. )
                    </span>
                  </div>
                  <p className="text-[11px] text-[#757684]">Manager Operasional / Pemilik</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 md:p-5 border-t border-[#c4c5d5]/30 bg-[#fbf8ff] flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-[12px] text-[#757684] flex items-center gap-2">
            {isGeneratingPdf ? (
              <div className="flex items-center gap-2 text-[#00288e] font-semibold animate-pulse">
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                <span>{pdfStatusMessage || 'Sedang memproses file PDF...'}</span>
              </div>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px] text-[#006c49]">verified</span>
                <span>Format resmi A4 siap unduh file PDF atau langsung cetak ke printer fisik.</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-[#c4c5d5] rounded-xl text-[13px] font-bold text-[#444653] hover:bg-[#f4f2fc] transition-colors cursor-pointer"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-[#00288e]/30 bg-[#dde1ff]/40 text-[#00288e] hover:bg-[#dde1ff]/80 rounded-xl text-[13px] font-bold transition-all cursor-pointer"
              title="Unduh file HTML mandiri yang dapat dibuka dan dicetak di peramban mana pun"
            >
              <span className="material-symbols-outlined text-[18px]">code</span>
              <span>Unduh .html</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNewTab}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-[#00288e]/30 bg-[#dde1ff]/40 text-[#00288e] hover:bg-[#dde1ff]/80 rounded-xl text-[13px] font-bold transition-all cursor-pointer"
              title="Buka dokumen di tab browser baru untuk pencetakan langsung tanpa batasan iframe"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
              <span>Buka di Tab Baru</span>
            </button>

            <button
              id="btn-trigger-printer"
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-[#00288e] text-[#00288e] hover:bg-[#00288e]/10 rounded-xl text-[13px] font-bold transition-all cursor-pointer"
              title="Kirim dokumen langsung ke dialog pencetakan printer sistem"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Cetak ke Printer</span>
            </button>

            <button
              id="btn-confirm-print-pdf"
              type="button"
              disabled={isGeneratingPdf}
              onClick={handleExportDirectPdf}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#00288e] text-white hover:bg-[#1e40af] disabled:bg-[#00288e]/60 rounded-xl text-[13px] font-bold shadow-md transition-all cursor-pointer"
              title="Download dokumen langsung sebagai file PDF (.pdf) resmi"
            >
              {isGeneratingPdf ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  <span>Download File PDF (.pdf)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
