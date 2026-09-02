import React, { useState, useMemo } from 'react';
import { Product, ReportFilter, Supplier, Transaction, User } from '../types';
import { AddaRasaLogo } from './AddaRasaLogo';
import { getProductStockSummary } from '../utils/stockCalculator';
import { exportReturnsReportToXLSX, exportIncomingReportToXLSX } from '../utils/excelParser';
import { ReportPrintModal } from './ReportPrintModal';

interface ReportViewProps {
  products: Product[];
  suppliers: Supplier[];
  transactions?: Transaction[];
  onOpenFilterModal: () => void;
  reportFilter: ReportFilter;
  onExportExcel: () => void;
  onOpenSalesExportModal?: () => void;
  currentUser?: User;
}

export const ReportView: React.FC<ReportViewProps> = ({
  products,
  suppliers,
  transactions = [],
  onOpenFilterModal,
  reportFilter,
  onExportExcel,
  onOpenSalesExportModal,
  currentUser,
}) => {
  const [reportType, setReportType] = useState<'inventory' | 'incoming' | 'sales' | 'returns'>('inventory');
  const [currentPage, setCurrentPage] = useState(1);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const itemsPerPage = 8;

  // Product fast lookup
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => {
      if (p.id) map.set(p.id, p);
      if (p.code) map.set(p.code.toLowerCase(), p);
      if (p.name) map.set(p.name.toLowerCase(), p);
    });
    return map;
  }, [products]);

  const resolveSupplier = (t: Transaction): string => {
    const matched =
      (t.productId ? productMap.get(t.productId) : undefined) ||
      (t.productCode ? productMap.get(t.productCode.toLowerCase()) : undefined) ||
      (t.productName ? productMap.get(t.productName.toLowerCase()) : undefined);

    if (matched?.supplier && matched.supplier.trim() !== '') {
      return matched.supplier;
    }
    if (t.supplier && t.supplier.trim() !== '') {
      return t.supplier;
    }
    if (t.type === 'IN' && t.sourceDestination) {
      return t.sourceDestination;
    }
    if (suppliers.length > 0) {
      return suppliers[0].name;
    }
    return '-';
  };

  const resolvePrice = (t: Transaction): number => {
    const matched =
      (t.productId ? productMap.get(t.productId) : undefined) ||
      (t.productCode ? productMap.get(t.productCode.toLowerCase()) : undefined) ||
      (t.productName ? productMap.get(t.productName.toLowerCase()) : undefined);
    return matched?.price || t.price || 0;
  };

  // Filter products based on reportFilter settings
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

  // Incoming Transactions (IN)
  const incomingTransactions = useMemo(() => {
    return transactions.filter((t) => t.type === 'IN').filter(filterTransactionByPeriod);
  }, [transactions, reportFilter]);

  // Outbound / Sales Transactions (OUT)
  const outboundTransactions = useMemo(() => {
    return transactions.filter((t) => t.type === 'OUT').filter(filterTransactionByPeriod);
  }, [transactions, reportFilter]);

  // Return Transactions (RETUR_IN & RETUR_OUT)
  const returnTransactions = useMemo(() => {
    return transactions.filter((t) => t.type === 'RETUR_IN' || t.type === 'RETUR_OUT').filter(filterTransactionByPeriod);
  }, [transactions, reportFilter]);

  const totalIncomingRevenue = useMemo(() => {
    return incomingTransactions.reduce((acc, t) => {
      const price = resolvePrice(t);
      return acc + t.quantity * price;
    }, 0);
  }, [incomingTransactions, productMap]);

  const totalIncomingQty = useMemo(() => {
    return incomingTransactions.reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
  }, [incomingTransactions]);

  const totalSalesRevenue = useMemo(() => {
    return outboundTransactions.reduce((acc, t) => {
      const price = resolvePrice(t);
      return acc + t.quantity * price;
    }, 0);
  }, [outboundTransactions, productMap]);

  const totalSalesQty = useMemo(() => {
    return outboundTransactions.reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
  }, [outboundTransactions]);

  const totalReturInQty = useMemo(() => {
    return returnTransactions
      .filter((t) => t.type === 'RETUR_IN')
      .reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
  }, [returnTransactions]);

  const totalReturOutQty = useMemo(() => {
    return returnTransactions
      .filter((t) => t.type === 'RETUR_OUT')
      .reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
  }, [returnTransactions]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  const handleExportIncomingExcel = () => {
    if (incomingTransactions.length === 0) {
      alert('Belum ada data barang masuk untuk diekspor.');
      return;
    }

    const items = incomingTransactions.map((t) => {
      const matched = productMap.get(t.productId || '') || productMap.get(t.productCode?.toLowerCase() || '');
      const price = resolvePrice(t);
      return {
        id: t.id,
        date: t.date,
        code: t.code,
        productId: t.productId,
        productCode: t.productCode || matched?.code || '-',
        productName: t.productName || matched?.name || 'Produk',
        category: t.category || matched?.category || 'Bahan Baku',
        supplier: resolveSupplier(t),
        unit: t.unit || matched?.unit || 'Pcs',
        quantity: t.quantity,
        price,
        totalPrice: t.quantity * price,
        sourceDestination: t.sourceDestination || '-',
        notes: t.notes,
      };
    });

    exportIncomingReportToXLSX(items, {
      month: reportFilter.month,
      supplier: reportFilter.supplier,
      startDate: reportFilter.startDate,
      endDate: reportFilter.endDate,
    });
  };

  const handleExportReturnsExcel = () => {
    if (returnTransactions.length === 0) {
      alert('Belum ada data transaksi retur untuk diekspor.');
      return;
    }

    const items = returnTransactions.map((t) => {
      const matchedProd = productMap.get(t.productId || '') || productMap.get(t.productCode?.toLowerCase() || '');
      const price = resolvePrice(t);

      return {
        id: t.id,
        date: t.date,
        code: t.code,
        type: t.type as 'RETUR_IN' | 'RETUR_OUT',
        productCode: t.productCode || matchedProd?.code || '-',
        productName: t.productName || matchedProd?.name || 'Produk',
        category: t.category || matchedProd?.category || 'Umum',
        supplier: resolveSupplier(t),
        unit: t.unit || matchedProd?.unit || 'Pcs',
        quantity: t.quantity,
        price,
        totalPrice: t.quantity * price,
        sourceDestination: t.sourceDestination,
        returnReason: t.returnReason,
        notes: t.notes,
        createdBy: t.createdBy,
      };
    });

    exportReturnsReportToXLSX(items, {
      filterMonth: reportFilter.month,
      companyName: 'ADDA RASA KJD',
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Actions & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-[28px] font-bold text-[#1a1b22] tracking-tight">
            Pusat Laporan & Rekapitulasi
          </h1>
          <p className="text-[14px] text-[#444653] mt-0.5">
            Laporan berkala stok inventaris, pergerakan barang, penjualan, dan rekapitulasi retur.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {reportType === 'incoming' && (
            <button
              id="btn-report-download-incoming-excel"
              onClick={handleExportIncomingExcel}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#006c49] text-white rounded-xl hover:bg-[#005137] transition-all shadow-xs text-[13px] font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span>Ekspor Barang Masuk (.xlsx)</span>
            </button>
          )}

          {reportType === 'sales' && (
            <button
              id="btn-open-sales-export"
              type="button"
              onClick={onOpenSalesExportModal}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00288e] text-white rounded-xl hover:bg-[#1e40af] transition-all shadow-xs text-[13px] font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
              <span>Download Laporan Penjualan</span>
            </button>
          )}

          {reportType === 'returns' && (
            <button
              id="btn-report-download-returns-excel"
              onClick={handleExportReturnsExcel}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#006874] text-white rounded-xl hover:bg-[#00515b] transition-all shadow-xs text-[13px] font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span>Ekspor Laporan Retur (.xlsx)</span>
            </button>
          )}

          {reportType === 'inventory' && (
            <button
              id="btn-report-download-excel"
              onClick={onExportExcel}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 border border-[#c4c5d5] rounded-xl text-[#1a1b22] hover:bg-[#f4f2fc] transition-colors text-[13px] font-semibold bg-white cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span>Ekspor Stok (.csv)</span>
            </button>
          )}

          <button
            id="btn-report-print-pdf"
            onClick={handlePrint}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00288e] text-white rounded-xl hover:bg-[#1e40af] transition-all shadow-xs text-[13px] font-bold cursor-pointer"
            title="Buka Pratinjau Dokumen Kop Surat Resmi untuk Dicetak atau Disimpan ke PDF"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Cetak / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-2 p-1 bg-[#f4f2fc] rounded-2xl border border-[#c4c5d5]/40 w-fit flex-wrap no-print">
        <button
          type="button"
          onClick={() => setReportType('inventory')}
          className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
            reportType === 'inventory'
              ? 'bg-white text-[#00288e] shadow-xs'
              : 'text-[#757684] hover:text-[#1a1b22]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">inventory_2</span>
          <span>Laporan Stok Inventaris</span>
        </button>

        <button
          type="button"
          onClick={() => setReportType('incoming')}
          className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
            reportType === 'incoming'
              ? 'bg-white text-[#006c49] shadow-xs'
              : 'text-[#757684] hover:text-[#1a1b22]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">input</span>
          <span>Laporan Barang Masuk</span>
        </button>

        <button
          type="button"
          onClick={() => setReportType('sales')}
          className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
            reportType === 'sales'
              ? 'bg-white text-[#00288e] shadow-xs'
              : 'text-[#757684] hover:text-[#1a1b22]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
          <span>Laporan Penjualan (Keluar)</span>
        </button>

        <button
          type="button"
          onClick={() => setReportType('returns')}
          className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all flex items-center gap-2 cursor-pointer ${
            reportType === 'returns'
              ? 'bg-white text-[#006874] shadow-xs'
              : 'text-[#757684] hover:text-[#1a1b22]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">assignment_return</span>
          <span>Laporan Retur Barang</span>
        </button>
      </div>

      {/* INCOMING REPORT QUICK SUMMARY */}
      {reportType === 'incoming' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
            <div className="bg-white p-5 rounded-2xl border border-[#c4c5d5]/30 shadow-xs">
              <span className="text-[12px] font-bold text-[#757684] uppercase block">
                Total Transaksi Masuk
              </span>
              <span className="text-[26px] font-bold text-[#1a1b22] mt-1 block">
                {incomingTransactions.length} Log
              </span>
              <span className="text-[12px] text-[#006c49] font-medium">Penerimaan dari Supplier</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#c4c5d5]/30 shadow-xs">
              <span className="text-[12px] font-bold text-[#757684] uppercase block">
                Total Unit Diterima
              </span>
              <span className="text-[26px] font-bold text-[#006c49] mt-1 block font-mono">
                +{totalIncomingQty.toLocaleString('id-ID')} unit
              </span>
              <span className="text-[12px] text-[#006c49] font-medium">Akumulasi kuantitas</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#c4c5d5]/30 shadow-xs">
              <span className="text-[12px] font-bold text-[#757684] uppercase block">
                Total Nilai Pengadaan
              </span>
              <span className="text-[26px] font-bold text-[#00288e] mt-1 block font-mono">
                Rp {totalIncomingRevenue.toLocaleString('id-ID')}
              </span>
              <span className="text-[12px] text-[#757684]">Berdasarkan harga satuan</span>
            </div>
          </div>
        </div>
      )}

      {/* SALES REPORT QUICK SUMMARY (When sales tab is active) */}
      {reportType === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
            <div className="bg-white p-5 rounded-2xl border border-[#c4c5d5]/30 shadow-xs">
              <span className="text-[12px] font-bold text-[#757684] uppercase block">
                Total Transaksi Keluar
              </span>
              <span className="text-[26px] font-bold text-[#1a1b22] mt-1 block">
                {outboundTransactions.length} Log
              </span>
              <span className="text-[12px] text-[#00288e] font-medium">Distribusi & Penjualan</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#c4c5d5]/30 shadow-xs">
              <span className="text-[12px] font-bold text-[#757684] uppercase block">
                Total Unit Terjual
              </span>
              <span className="text-[26px] font-bold text-[#006c49] mt-1 block font-mono">
                {totalSalesQty.toLocaleString('id-ID')} unit
              </span>
              <span className="text-[12px] text-[#006c49] font-medium">Akumulasi kuantitas</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#c4c5d5]/30 shadow-xs">
              <span className="text-[12px] font-bold text-[#757684] uppercase block">
                Estimasi Nilai Omset
              </span>
              <span className="text-[26px] font-bold text-[#00288e] mt-1 block font-mono">
                Rp {totalSalesRevenue.toLocaleString('id-ID')}
              </span>
              <span className="text-[12px] text-[#757684]">Berdasarkan harga master</span>
            </div>
          </div>
        </div>
      )}

      {/* RETURNS REPORT QUICK SUMMARY (When returns tab is active) */}
      {reportType === 'returns' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
            <div className="bg-white p-5 rounded-2xl border border-[#c4c5d5]/30 shadow-xs">
              <span className="text-[12px] font-bold text-[#757684] uppercase block">
                Total Transaksi Retur
              </span>
              <span className="text-[26px] font-bold text-[#1a1b22] mt-1 block">
                {returnTransactions.length} Log
              </span>
              <span className="text-[12px] text-[#006874] font-medium">Masuk & Keluar</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#c4c5d5]/30 shadow-xs">
              <span className="text-[12px] font-bold text-[#006874] uppercase block">
                Retur Masuk (+Outlet)
              </span>
              <span className="text-[26px] font-bold text-[#006874] mt-1 block font-mono">
                +{totalReturInQty.toLocaleString('id-ID')} unit
              </span>
              <span className="text-[12px] text-[#757684]">Kembali ke gudang</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#c4c5d5]/30 shadow-xs">
              <span className="text-[12px] font-bold text-[#9a4500] uppercase block">
                Retur Keluar (-Supplier)
              </span>
              <span className="text-[26px] font-bold text-[#9a4500] mt-1 block font-mono">
                -{totalReturOutQty.toLocaleString('id-ID')} unit
              </span>
              <span className="text-[12px] text-[#757684]">Pengembalian ke vendor</span>
            </div>
          </div>
        </div>
      )}

      {/* Report Container (Printable Area Look) */}
      <div className="bg-white rounded-2xl ambient-shadow border border-[#c4c5d5]/30 overflow-hidden printable-area">
        {/* Report Header / Branding */}
        <div className="p-6 md:p-8 border-b border-[#c4c5d5]/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[#ffffff]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-18 flex items-center justify-center">
              <AddaRasaLogo size="md" width={56} height={72} showText={false} theme="gold" />
            </div>
            <div>
              <h3 className="text-[20px] text-[#00288e] font-bold">ADDA RASA KJD</h3>
              <p className="text-[12px] font-semibold text-[#444653] uppercase tracking-wider">
                {reportType === 'inventory'
                  ? 'Inventory Management System'
                  : reportType === 'incoming'
                  ? 'Supply Chain & Inbound Management System'
                  : reportType === 'sales'
                  ? 'Sales & Distribution System'
                  : 'Return & Damage Management System'}
              </p>
              <p className="text-[11px] text-[#757684]">
                Adda Rasa KJD Kompleks Alvita Blok Q Nomor 14, Kelurahan Sawah Lama, Kecamatan Ciputat, Kota Tangerang Selatan, Banten | addarasakjd@gmail.com
              </p>
            </div>
          </div>

          {/* Filters Display Meta Box */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-[14px] bg-[#f4f2fc] p-4 rounded-xl border border-[#c4c5d5]/50 w-full md:w-auto">
            <div>
              <span className="block text-[11px] font-bold text-[#757684] uppercase mb-0.5">
                Periode
              </span>
              <span className="text-[13px] font-semibold text-[#1a1b22]">
                {reportFilter.startDate} - {reportFilter.endDate}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-bold text-[#757684] uppercase mb-0.5">
                Bulan
              </span>
              <span className="text-[13px] font-semibold text-[#1a1b22]">
                {reportFilter.month}
              </span>
            </div>
            <div className="col-span-2 md:col-span-1">
              <span className="block text-[11px] font-bold text-[#757684] uppercase mb-0.5">
                Supplier
              </span>
              <span className="text-[13px] font-semibold text-[#1a1b22]">
                {reportFilter.supplier}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Controls Header */}
        <div className="px-6 md:px-8 py-3.5 border-b border-[#c4c5d5]/30 bg-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-[#444653]">
            <span className="material-symbols-outlined text-[20px]">filter_list</span>
            <span className="text-[12px] font-bold">
              {reportType === 'inventory'
                ? 'Filter Data Inventaris'
                : reportType === 'incoming'
                ? 'Daftar Barang Masuk (Pengadaan)'
                : reportType === 'sales'
                ? 'Daftar Barang Keluar (Penjualan)'
                : 'Daftar Transaksi Retur Barang'}
            </span>
          </div>
          {reportType === 'inventory' ? (
            <button
              id="btn-ubah-filter"
              onClick={onOpenFilterModal}
              className="text-[#00288e] hover:text-[#1e40af] text-[12px] font-bold transition-colors cursor-pointer"
            >
              Ubah Filter
            </button>
          ) : reportType === 'incoming' ? (
            <button
              onClick={handleExportIncomingExcel}
              className="text-[#006c49] hover:text-[#005137] text-[12px] font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Download Excel Masuk (.xlsx)</span>
            </button>
          ) : reportType === 'sales' ? (
            <button
              onClick={onOpenSalesExportModal}
              className="text-[#00288e] hover:text-[#1e40af] text-[12px] font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Download Excel & Cetak Dokumen</span>
            </button>
          ) : (
            <button
              onClick={handleExportReturnsExcel}
              className="text-[#006874] hover:text-[#00515b] text-[12px] font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>Download Excel Retur (.xlsx)</span>
            </button>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {reportType === 'inventory' ? (
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#eeedf7]/60 border-b border-[#c4c5d5]/50">
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase w-28">
                    Kode
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Produk
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Supplier
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase text-right w-36">
                    Stok Akhir
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase w-40">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#c4c5d5]/30 bg-white text-[14px] text-[#1a1b22]">
                {currentProducts.length > 0 ? (
                  currentProducts.map((p) => {
                    const summary = getProductStockSummary(p, transactions);
                    const stock = summary.currentStock;
                    const health = summary.health;

                    return (
                      <tr key={p.id} className="hover:bg-[#f4f2fc]/50 transition-colors">
                        <td className="py-4 px-6 font-mono text-[13px] text-[#444653]">
                          {p.code}
                        </td>
                        <td className="py-4 px-6 font-medium text-[#1a1b22]">
                          {p.name}
                        </td>
                        <td className="py-4 px-6 text-[13px] text-[#444653]">
                          {p.supplier}
                        </td>
                        <td
                          className={`py-4 px-6 text-right font-mono text-[13px] font-semibold ${
                            health === 'Habis' ? 'text-[#ba1a1a]' : 'text-[#1a1b22]'
                          }`}
                        >
                          {stock} {p.unit}
                        </td>
                        <td className="py-4 px-6">
                          {health === 'Aman' && (
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#6cf8bb]/20 text-[#00714d] border border-[#6cf8bb]/30">
                              <span className="w-2 h-2 rounded-full bg-[#006c49]" />
                              <span className="text-[11px] font-semibold">Aman</span>
                            </div>
                          )}

                          {health === 'Menipis' && (
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#6b4200]/10 text-[#4c2e00] border border-[#6b4200]/20">
                              <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                              <span className="text-[11px] font-semibold">Menipis</span>
                            </div>
                          )}

                          {health === 'Habis' && (
                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#ffdad6]/60 text-[#93000a] border border-[#ffdad6]">
                              <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
                              <span className="text-[11px] font-semibold">Habis</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 px-6 text-center text-[#757684]">
                      <span className="material-symbols-outlined text-[36px] text-[#757684] mb-2 block">
                        inventory_2
                      </span>
                      <p className="text-[14px] font-semibold text-[#1a1b22]">
                        Tidak Ada Data Produk
                      </p>
                      <p className="text-[12px] text-[#757684] mt-1 max-w-sm mx-auto">
                        Belum ada data barang yang sesuai dengan filter laporan saat ini.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : reportType === 'incoming' ? (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#eeedf7]/60 border-b border-[#c4c5d5]/50">
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Tanggal
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    No Transaksi
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Produk
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Supplier
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase text-right">
                    Qty Masuk
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase text-right">
                    Harga (Rp)
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase text-right">
                    Total (Rp)
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Keterangan / Dokumen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4c5d5]/30 bg-white text-[14px] text-[#1a1b22]">
                {incomingTransactions.length > 0 ? (
                  incomingTransactions.slice(0, 15).map((t) => {
                    const supplierName = resolveSupplier(t);
                    const price = resolvePrice(t);
                    const total = t.quantity * price;

                    return (
                      <tr key={t.id} className="hover:bg-[#f4f2fc]/50 transition-colors">
                        <td className="py-4 px-6 font-mono text-[13px] text-[#444653]">
                          {t.date}
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-[#00288e]">
                          {t.code}
                        </td>
                        <td className="py-4 px-6 font-semibold text-[#1a1b22]">
                          <div>{t.productName}</div>
                          <div className="text-[11px] text-[#757684] font-mono">{t.productCode}</div>
                        </td>
                        <td className="py-4 px-6 text-[13px] text-[#1a1b22] font-medium">
                          {supplierName}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-bold text-[#006c49]">
                          +{t.quantity} {t.unit}
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-[#444653]">
                          Rp {price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-bold text-[#00288e]">
                          Rp {total.toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-6 text-[13px] text-[#444653]">
                          {t.notes || t.sourceDestination || '-'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 px-6 text-center text-[#757684]">
                      <span className="material-symbols-outlined text-[36px] text-[#757684] mb-2 block">
                        input
                      </span>
                      <p className="text-[14px] font-semibold text-[#1a1b22]">
                        Belum Ada Transaksi Barang Masuk
                      </p>
                      <p className="text-[12px] text-[#757684] mt-1 max-w-sm mx-auto">
                        Catat penerimaan barang di modul Transaksi untuk melihat rekapitulasi.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : reportType === 'sales' ? (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#eeedf7]/60 border-b border-[#c4c5d5]/50">
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Tanggal
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    No Transaksi
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Produk
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Supplier
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase text-right">
                    Qty Terjual
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase text-right">
                    Harga (Rp)
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase text-right">
                    Total (Rp)
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Tujuan / Keterangan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4c5d5]/30 bg-white text-[14px] text-[#1a1b22]">
                {outboundTransactions.length > 0 ? (
                  outboundTransactions.slice(0, 15).map((t) => {
                    const supplierName = resolveSupplier(t);
                    const price = resolvePrice(t);
                    const total = t.quantity * price;

                    return (
                      <tr key={t.id} className="hover:bg-[#f4f2fc]/50 transition-colors">
                        <td className="py-4 px-6 font-mono text-[13px] text-[#444653]">
                          {t.date}
                        </td>
                        <td className="py-4 px-6 font-mono font-bold text-[#00288e]">
                          {t.code}
                        </td>
                        <td className="py-4 px-6 font-semibold text-[#1a1b22]">
                          <div>{t.productName}</div>
                          <div className="text-[11px] text-[#757684] font-mono">{t.productCode}</div>
                        </td>
                        <td className="py-4 px-6 text-[13px] text-[#1a1b22] font-medium">
                          {supplierName}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-bold text-[#ba1a1a]">
                          {t.quantity} {t.unit}
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-[#444653]">
                          Rp {price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-bold text-[#00288e]">
                          Rp {total.toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-6 text-[13px] text-[#444653]">
                          {t.sourceDestination} {t.notes ? `(${t.notes})` : ''}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 px-6 text-center text-[#757684]">
                      <span className="material-symbols-outlined text-[36px] text-[#757684] mb-2 block">
                        shopping_bag
                      </span>
                      <p className="text-[14px] font-semibold text-[#1a1b22]">
                        Belum Ada Transaksi Penjualan
                      </p>
                      <p className="text-[12px] text-[#757684] mt-1 max-w-sm mx-auto">
                        Catat pengeluaran barang / penjualan di modul Transaksi untuk melihat rekapitulasi.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-[#eeedf7]/60 border-b border-[#c4c5d5]/50">
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Tanggal
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    No Transaksi
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Produk
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Supplier
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Jenis Retur
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase text-right">
                    Jumlah Retur
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase text-right">
                    Harga (Rp)
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase text-right">
                    Total (Rp)
                  </th>
                  <th className="py-4 px-6 text-[12px] font-bold text-[#444653] uppercase">
                    Alasan Retur / Catatan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4c5d5]/30 bg-white text-[14px] text-[#1a1b22]">
                {returnTransactions.length > 0 ? (
                  returnTransactions.map((t) => {
                    const supplierName = resolveSupplier(t);
                    const price = resolvePrice(t);
                    const total = t.quantity * price;

                    return (
                      <tr key={t.id} className="hover:bg-[#f4f2fc]/50 transition-colors">
                        <td className="py-4 px-6 font-mono text-[13px] text-[#444653]">
                          {t.date}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap font-mono font-bold text-[#00288e] text-[13px]">
                          {t.code}
                        </td>
                        <td className="py-4 px-6 font-semibold text-[#1a1b22]">
                          <div>{t.productName}</div>
                          <div className="text-[11px] text-[#757684] font-mono">{t.productCode}</div>
                        </td>
                        <td className="py-4 px-6 text-[13px] text-[#1a1b22] font-medium">
                          {supplierName}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.type === 'RETUR_IN'
                                ? 'bg-[#006874]/15 text-[#006874]'
                                : 'bg-[#9a4500]/15 text-[#9a4500]'
                            }`}
                          >
                            {t.type === 'RETUR_IN' ? 'RETUR MASUK (+)' : 'RETUR KELUAR (-)'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-bold text-[14px]">
                          <span className={t.type === 'RETUR_IN' ? 'text-[#006874]' : 'text-[#9a4500]'}>
                            {t.type === 'RETUR_IN' ? '+' : '-'}
                            {t.quantity} {t.unit}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-[#444653]">
                          Rp {price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-bold text-[#00288e]">
                          Rp {total.toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-6 text-[13px] text-[#1a1b22]">
                          <div className="font-semibold">{t.returnReason || '-'}</div>
                          {t.notes && <div className="text-[11px] text-[#757684] truncate max-w-xs">{t.notes}</div>}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 px-6 text-center text-[#757684]">
                      <span className="material-symbols-outlined text-[36px] text-[#757684] mb-2 block">
                        assignment_return
                      </span>
                      <p className="text-[14px] font-semibold text-[#1a1b22]">
                        Belum Ada Transaksi Retur
                      </p>
                      <p className="text-[12px] text-[#757684] mt-1 max-w-sm mx-auto">
                        Pencatatan retur masuk dari outlet atau retur keluar ke supplier akan tampil di rekapitulasi ini.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Report Footer */}
        <div className="p-4 border-t border-[#c4c5d5]/30 bg-white flex justify-between items-center text-[13px] text-[#444653]">
          <span className="font-semibold text-[#444653]">
            {reportType === 'inventory'
              ? `Menampilkan ${currentProducts.length} dari ${filteredProducts.length} barang`
              : reportType === 'incoming'
              ? `Menampilkan ${incomingTransactions.length} transaksi barang masuk`
              : reportType === 'sales'
              ? `Menampilkan ${outboundTransactions.length} transaksi keluar (penjualan)`
              : `Menampilkan ${returnTransactions.length} transaksi retur`}
          </span>

          {reportType === 'inventory' && (
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded hover:bg-[#eeedf7] disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <span className="font-medium text-[#1a1b22]">
                Halaman {currentPage} dari {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded hover:bg-[#eeedf7] disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Pratinjau & Cetak PDF */}
      <ReportPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        products={products}
        suppliers={suppliers}
        transactions={transactions}
        reportFilter={reportFilter}
        currentUser={currentUser}
        initialReportType={reportType}
      />
    </div>
  );
};
