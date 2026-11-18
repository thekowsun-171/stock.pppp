import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Product, Transaction } from '../types/inventory';
import { formatThaiShortDate } from './format';

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsvFile(filename: string, rows: Array<Array<string | number>>) {
  const csvContent =
    '\uFEFF' + rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  monthKey: string
): void {
  const headers = [
    'วันที่ (พ.ศ.)',
    'ประเภท',
    'รหัสสินค้า',
    'ชื่อสินค้า',
    'หมวดหมู่',
    'หน่วยนับ',
    'จำนวน',
    'ราคาต่อหน่วย (บาท)',
    'มูลค่ารวม (บาท)',
    'ผู้ขาย / ผู้เบิก',
    'หมายเหตุ',
    'ผู้แก้ไขล่าสุด',
  ];

  const rows = transactions.map((t) => [
    formatThaiShortDate(t.date),
    t.type,
    t.productCode,
    t.productName,
    t.category,
    t.unit,
    t.quantity,
    Number(t.unitPrice.toFixed(2)),
    Number((t.quantity * t.unitPrice).toFixed(2)),
    t.party,
    t.notes,
    t.editedBy,
  ]);

  downloadCsvFile(
    `รายการเคลื่อนไหวสต็อค_${monthKey || 'ทั้งหมด'}_พิพุทพูนผล.csv`,
    [headers, ...rows]
  );
}

export function exportInventoryToCsv(products: Product[]): void {
  const headers = [
    'รหัสสินค้า',
    'ชื่อสินค้า',
    'หมวดหมู่',
    'หน่วยนับ',
    'คงเหลือ',
    'ราคาต่อหน่วย (บาท)',
    'มูลค่าคงเหลือ (บาท)',
    'ผู้ขายล่าสุด',
    'อัปเดตล่าสุด',
    'หมายเหตุ',
  ];

  const rows = products.map((p) => [
    p.code,
    p.name,
    p.category,
    p.unit,
    p.quantity,
    Number(p.unitPrice.toFixed(2)),
    Number((p.quantity * p.unitPrice).toFixed(2)),
    p.vendor,
    formatThaiShortDate(p.updatedAt),
    p.notes,
  ]);

  const today = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`สรุปสต็อคคงเหลือ_${today}_พิพุทพูนผล.csv`, [
    headers,
    ...rows,
  ]);
}

export async function exportMonthlyPdf(
  element: HTMLElement,
  monthKey: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const printableWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * printableWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, printableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  pdf.save(`รายงานสต็อคและบัญชีประจำเดือน_${monthKey}_พิพุทพูนผล.pdf`);
}
