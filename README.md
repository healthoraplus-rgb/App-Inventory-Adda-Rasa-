# ADDA RASA KJD - Sistem Manajemen Inventaris & Stok (Production Ready)

Sistem Manajemen Inventaris & Pergudangan Modern untuk **ADDA RASA KJD**, dilengkapi dengan kalkulasi stok fisik real-time, pencatatan transaksi mutasi (Barang Masuk, Penjualan, Retur), integrasi 2 arah Google Spreadsheet (Google Apps Script), barcode scanner, import/export Excel (.xlsx), dan cetak laporan PDF resmi.

---

## 🌟 Fitur Utama & Modul Sistem

1. **Dashboard & Ringkasan Metrik**:
   - Total Produk (SKU) terdaftar.
   - Total Stok Fisik Real-Time (`Stok Awal + Masuk + Retur Masuk - Keluar - Retur Keluar`).
   - Total Mutasi Masuk & Mutasi Keluar.
   - Grafik Donut Distribusi Supplier & Grafik Batang Distribusi Kategori.
   - Peringatan Otomatis Produk Kritis (di bawah batas minimum stok).

2. **Master Data Produk**:
   - CRUD Produk (Kode SKU, Nama, Kategori, Satuan, Supplier, Harga, Stok Awal, Stok Minimum).
   - Filter Kategori & Filter Supplier.
   - Import Data Produk via Excel (.xlsx) dengan auto-mapping kolom & deteksi supplier baru.
   - Export Katalog Produk ke Excel (.xlsx).
   - Cetak Label Barcode / QR Code Produk.
   - Opsi Kosongkan / Reset Database Bersih.

3. **Manajemen Stok & Stock Opname**:
   - Monitoring status kesehatan stok (Aman, Menipis, Habis).
   - Penyesuaian Kuantitas Fisik (Stock Opname) langsung di tabel.
   - Tombol Sinkronisasi Mutasi Real-Time.
   - Generator Pesan Restock Darurat via WhatsApp / Email ke Vendor Supplier.

4. **Transaksi & Mutasi Barang**:
   - **Barang Masuk (IN)**: Dari supplier / vendor rekanan ke gudang.
   - **Penjualan / Barang Keluar (OUT)**: Ke konsumen / outlet / pesanan dine-in.
   - **Retur Masuk (RETUR_IN)**: Pengembalian barang dari konsumen/outlet.
   - **Retur Keluar (RETUR_OUT)**: Pengembalian barang rusak/cacat ke supplier.
   - Filter per tipe mutasi, pencarian nomor transaksi, dan ekspor data ke Excel & PDF.

5. **Master Mitra Supplier**:
   - Database Supplier (Kode, Nama PT/CV, PIC, No. Telepon/WhatsApp, Email, Alamat).
   - Tautan langsung WhatsApp & Email ke supplier.
   - Status Aktif / Tidak Aktif.

6. **Laporan & Export PDF / Excel**:
   - Tab Laporan Ringkasan Stok, Laporan Barang Masuk, Laporan Penjualan, dan Laporan Retur.
   - Filter rentang tanggal dan periode bulan.
   - Cetak & Download PDF resmi dengan kop surat ADDA RASA KJD.
   - Kolom standar akurat: *No, Tgl, No. Transaksi, Nama Produk, Qty, Satuan, Harga, Total, Supplier, Asal/Tujuan*.

7. **Integrasi Google Spreadsheet (2-Way Realtime Sync)**:
   - Koneksi via Google Apps Script Web App (bebas hambatan CORS, fallback multi-tier ke backend proxy / JSONP).
   - Sinkronisasi otomatis saat ada mutasi data.
   - Fitur Upload ke Sheet dan Tarik Data dari Sheet kapan saja.

8. **Pengaturan Akun & Multi-Pengguna**:
   - Manajemen profil pengguna & hak akses.
   - Tambah, edit, aktifkan/nonaktifkan, dan hapus akun operator.
   - Pengaturan ambang batas stok minimum dan notifikasi.

---

## 🔑 Kredensial Login Default (Akun Administrator)

| Username | Password | Role | Status |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | **Inventory Manager** | **Aktif** |

---

## 🚀 Panduan Menjalankan Secara Lokal (Development)

### Prasyarat:
- **Node.js**: Versi 18 atau lebih baru.
- **npm** atau **yarn** / **pnpm**.

### Langkah-langkah:
```bash
# 1. Clone repository dari GitHub
git clone https://github.com/USERNAME/REPO_NAME.git
cd REPO_NAME

# 2. Install dependensi
npm install

# 3. Jalankan server development
npm run dev
```
Aplikasi akan aktif dan dapat diakses di browser pada: `http://localhost:3000`

---

## 📦 Panduan Build untuk Produksi

```bash
npm run build
```
Perintah ini akan meng-compile frontend ke folder `dist/` dan server backend proxy ke `dist/server.cjs`.

Untuk menjalankan hasil build lokal:
```bash
npm run preview
# atau
npm start
```

---

## 🌐 Panduan Deploy ke Netlify (Gratis & Cepat)

Proyek ini telah dilengkapi dengan file konfigurasi `netlify.toml` dan `public/_redirects` sehingga **100% siap dideploy ke Netlify**.

### Cara 1: Deploy Otomatis via GitHub (Disarankan)
1. Push kode proyek ke repository **GitHub** Anda (lihat panduan push di bawah).
2. Buka [app.netlify.com](https://app.netlify.com) dan login.
3. Klik **"Add new site"** > **"Import an existing project"** > Pilih **GitHub**.
4. Pilih repository inventaris Anda.
5. Konfigurasi build setting (akan otomatis terisi dari `netlify.toml`):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Klik **"Deploy site"**. Dalam hitungan detik website Anda langsung online!

### Cara 2: Deploy Manual (Drag & Drop)
1. Jalankan `npm run build` di terminal lokal Anda.
2. Buka dashboard Netlify di browser.
3. Drag & drop folder `dist` ke area deploy Netlify.

---

## 🐙 Panduan Push ke GitHub

Jalankan perintah berikut di terminal Anda:

```bash
# 1. Inisialisasi git (jika belum)
git init

# 2. Tambahkan semua file yang sudah bersih
git add .

# 3. Buat commit pertama
git commit -m "feat: initial production release of ADDA RASA KJD Inventory System"

# 4. Buat branch main
git branch -M main

# 5. Hubungkan ke repository GitHub Anda
git remote add origin https://github.com/USERNAME/NAMA-REPO-ANDA.git

# 6. Push ke GitHub
git push -u origin main
```

---

## 📊 Konfigurasi Google Apps Script (Opsional)

Untuk menghubungkan sistem dengan Google Spreadsheet Anda secara langsung:

1. Buat Google Spreadsheet baru di [Google Sheets](https://sheets.new).
2. Buka menu **Extensions** (Ekstensi) > **Apps Script**.
3. Salin kode template Apps Script yang tersedia di aplikasi (Menu **Pengaturan** > Tab **Google Spreadsheet** > **Lihat Kode Apps Script**).
4. Klik **Deploy** > **New Deployment** > Pilih tipe **Web App**.
   - **Execute as**: *Me (email Anda)*
   - **Who has access**: *Anyone* (Siapa saja)
5. Salin URL Web App yang dihasilkan (format: `https://script.google.com/macros/s/.../exec`).
6. Masukkan URL tersebut ke modal sinkronisasi di aplikasi.

---

## 🏢 Kontak & Dukungan
**ADDA RASA KJD**  
Kompleks Alvita Blok Q Nomor 14, Kelurahan Sawah Lama, Kecamatan Ciputat, Kota Tangerang Selatan, Banten  
WhatsApp: `+62 081282585434` | Email: `addarasakjd@gmail.com`
