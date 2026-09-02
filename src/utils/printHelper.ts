import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Helper to safely construct a jsPDF instance across various bundlers & ESM versions
 */
const createJsPdfInstance = (options = { orientation: 'portrait', unit: 'mm', format: 'a4', compress: true }) => {
  try {
    if (typeof jsPDF === 'function') {
      return new jsPDF(options as any);
    }
    // @ts-ignore
    if (jsPDF && typeof (jsPDF as any).jsPDF === 'function') {
      // @ts-ignore
      return new (jsPDF as any).jsPDF(options);
    }
    // @ts-ignore
    if (jsPDF && typeof (jsPDF as any).default === 'function') {
      // @ts-ignore
      return new (jsPDF as any).default(options);
    }
    // @ts-ignore
    if (typeof (window as any).jspdf?.jsPDF === 'function') {
      // @ts-ignore
      return new (window as any).jspdf.jsPDF(options);
    }
  } catch (err) {
    console.error('Failed to create jsPDF instance directly, falling back:', err);
  }
  return new jsPDF(options as any);
};

/**
 * Builds standard standalone document HTML with complete typography & print-ready styles
 */
export const buildPrintableDocumentHtml = (
  contentHtml: string,
  documentTitle: string = 'Laporan Resmi ADDA RASA KJD'
): string => {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 10mm 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 24px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1b22;
      background-color: #f4f4f9;
      font-size: 11px;
      line-height: 1.4;
    }
    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }
    .action-toolbar {
      max-width: 800px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #00288e;
      color: white;
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 40, 142, 0.2);
    }
    .action-toolbar h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
    }
    .action-toolbar .btn-group {
      display: flex;
      gap: 10px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-print {
      background: #ffffff;
      color: #00288e;
    }
    .btn-print:hover {
      background: #dde1ff;
    }
    .btn-close {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }
    .btn-close:hover {
      background: rgba(255, 255, 255, 0.35);
    }
    .paper-sheet {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 28px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 6px 8px;
    }
    tr {
      page-break-inside: avoid;
    }
    .no-print {
      display: none !important;
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .action-toolbar {
        display: none !important;
      }
      .paper-sheet {
        box-shadow: none;
        padding: 0;
        border-radius: 0;
        max-width: 100%;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="action-toolbar">
    <div>
      <h2>${documentTitle}</h2>
      <span style="font-size: 11px; opacity: 0.85;">ADDA RASA KJD &bull; Sistem Inventaris & Laporan</span>
    </div>
    <div class="btn-group">
      <button class="btn btn-print" onclick="window.print()">
        <span>🖨️ Cetak / Simpan PDF</span>
      </button>
      <button class="btn btn-close" onclick="window.close()">
        <span>✕ Tutup</span>
      </button>
    </div>
  </div>
  <div class="paper-sheet">
    ${contentHtml}
  </div>
  <script>
    // Auto trigger print dialog when page loads
    window.addEventListener('load', () => {
      setTimeout(() => {
        try {
          window.print();
        } catch(e) {
          console.error(e);
        }
      }, 500);
    });
  </script>
</body>
</html>`;
};

/**
 * Generates and downloads a direct high-quality PDF (.pdf) file from an HTML element
 * that exactly matches the visual preview.
 */
export const exportElementToPdf = async (
  element: HTMLElement | null,
  fileName: string = 'Laporan_ADDA_RASA.pdf',
  onProgress?: (status: string) => void
): Promise<boolean> => {
  if (!element) {
    console.error('exportElementToPdf: Element is null');
    onProgress?.('Gagal: Elemen dokumen tidak ditemukan');
    return false;
  }

  const finalFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  try {
    onProgress?.('Mempersiapkan tata letak dokumen...');

    // Wait for fonts to load
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // Ignore font loading errors
      }
    }

    onProgress?.('Merender grafik & data tabel...');

    // Render directly using html2canvas with onclone to retain 100% accurate styling
    const canvas = await html2canvas(element, {
      scale: 2, // 2x high resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc, clonedEl) => {
        // Reset any zoom scale transform from modal preview
        clonedEl.style.transform = 'none';
        clonedEl.style.webkitTransform = 'none';
        clonedEl.style.width = '794px';
        clonedEl.style.minWidth = '794px';
        clonedEl.style.maxWidth = '794px';
        clonedEl.style.boxSizing = 'border-box';
        clonedEl.style.margin = '0 auto';
        clonedEl.style.boxShadow = 'none';
        clonedEl.style.borderRadius = '0';
        clonedEl.style.display = 'block';
        clonedEl.style.visibility = 'visible';
        clonedEl.classList.remove('hidden');

        // Remove no-print elements
        const noPrintEls = clonedEl.querySelectorAll('.no-print');
        noPrintEls.forEach((el) => el.remove());

        // Ensure all logo images / SVGs maintain their exact proportional size
        const svgs = clonedEl.querySelectorAll('svg');
        svgs.forEach((svg) => {
          svg.style.maxWidth = '100%';
          svg.style.maxHeight = '100%';
          svg.style.flexShrink = '0';
        });
      },
    });

    onProgress?.('Menyusun halaman PDF...');

    const pdf = createJsPdfInstance({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth(); // 210 mm
    const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm
    
    // Use 8mm page margins
    const margin = 8;
    const contentWidth = pageWidth - (margin * 2); // 194 mm
    const contentHeight = (canvas.height * contentWidth) / canvas.width;
    const usablePageHeight = pageHeight - (margin * 2); // 281 mm

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (contentHeight <= usablePageHeight) {
      // Single Page: Fits neatly within 1 page
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, contentHeight, undefined, 'FAST');
    } else {
      // Multi-Page: Clean slicing with consistent margins
      let heightLeft = contentHeight;
      let position = margin;
      let pageNumber = 1;

      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
      heightLeft -= usablePageHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        pageNumber++;
        position = margin - (usablePageHeight * (pageNumber - 1));
        pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
        heightLeft -= usablePageHeight;
      }
    }

    onProgress?.('Mengunduh file PDF...');

    let downloaded = false;

    // Direct download strategy 1: standard pdf.save
    try {
      pdf.save(finalFileName);
      downloaded = true;
    } catch (saveErr) {
      console.warn('pdf.save failed, trying blob url trigger:', saveErr);
    }

    // Direct download strategy 2: Blob URL trigger
    if (!downloaded) {
      try {
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = finalFileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        }, 3000);
        downloaded = true;
      } catch (blobErr) {
        console.warn('Blob URL trigger failed:', blobErr);
      }
    }

    onProgress?.('Selesai! Berkas PDF berhasil diunduh.');
    return true;
  } catch (error) {
    console.error('Error generating PDF with html2canvas:', error);
    onProgress?.('Membuka pratinjau dokumen cetak/PDF...');
    openDocumentInNewTab(element.innerHTML, finalFileName.replace('.pdf', ''));
    return true;
  }
};

/**
 * Triggers standard browser print dialog for isolated printing.
 * Works inside and outside iframe sandbox environments.
 */
export const printElement = (element: HTMLElement | null, documentTitle: string = 'Laporan ADDA RASA KJD') => {
  if (!element) {
    window.print();
    return;
  }

  const originalTitle = document.title;
  document.title = documentTitle;

  // Try iframe print first (most reliable in iframe sandbox)
  try {
    const printFrame = document.createElement('iframe');
    printFrame.id = 'hidden-print-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.title = 'Print Frame';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (doc) {
      const fullHtml = buildPrintableDocumentHtml(element.innerHTML, documentTitle);
      doc.open();
      doc.write(fullHtml);
      doc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (iframeErr) {
          console.warn('Iframe print error, falling back to direct print:', iframeErr);
          fallbackDirectPrint(element, documentTitle);
        } finally {
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
            document.title = originalTitle;
          }, 3000);
        }
      }, 500);
      return;
    }
  } catch (err) {
    console.warn('Iframe print failed, trying direct DOM mount:', err);
  }

  // Fallback to direct DOM print
  fallbackDirectPrint(element, documentTitle);
};

const fallbackDirectPrint = (element: HTMLElement, documentTitle: string) => {
  const originalTitle = document.title;
  document.title = documentTitle;

  const existingPrintContainer = document.getElementById('isolated-print-mount');
  if (existingPrintContainer) {
    existingPrintContainer.remove();
  }

  const printMount = document.createElement('div');
  printMount.id = 'isolated-print-mount';
  printMount.className = 'print-only-target';
  
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.display = 'block';
  clone.classList.remove('hidden');
  
  printMount.appendChild(clone);
  document.body.appendChild(printMount);

  document.body.classList.add('is-printing-active');

  try {
    window.print();
  } catch (err) {
    console.warn('Direct window.print failed, opening in new tab:', err);
    openDocumentInNewTab(element.innerHTML, documentTitle);
  } finally {
    setTimeout(() => {
      document.body.classList.remove('is-printing-active');
      if (document.body.contains(printMount)) {
        document.body.removeChild(printMount);
      }
      document.title = originalTitle;
    }, 1500);
  }
};

/**
 * Opens document in a clean new browser tab formatted for printing / saving as PDF.
 * This completely bypasses iframe sandbox print restrictions.
 */
export const openDocumentInNewTab = (contentHtml: string, documentTitle: string = 'Laporan ADDA RASA KJD') => {
  const fullHtml = buildPrintableDocumentHtml(contentHtml, documentTitle);
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  
  const win = window.open(blobUrl, '_blank');
  if (!win || win.closed || typeof win.closed === 'undefined') {
    downloadDocumentAsHtml(contentHtml, `${documentTitle.replace(/\s+/g, '_')}.html`, documentTitle);
  }
};

/**
 * Downloads document as standalone HTML file that can be opened anywhere
 */
export const downloadDocumentAsHtml = (
  contentHtml: string,
  fileName: string = 'Laporan_ADDA_RASA.html',
  documentTitle: string = 'Laporan Resmi ADDA RASA KJD'
) => {
  const fullHtml = buildPrintableDocumentHtml(contentHtml, documentTitle);
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName.endsWith('.html') ? fileName : `${fileName}.html`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 2000);
};
