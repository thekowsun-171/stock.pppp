import React, { useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Edit3,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Search,
} from 'lucide-react';
import { Product, Transaction } from '../types/inventory';
import {
  exportInventoryToCsv,
  exportMonthlyPdf,
  exportTransactionsToCsv,
} from '../utils/exportReports';
import {
  formatCurrency,
  formatNumber,
  formatThaiMonthLabel,
  formatThaiShortDate,
  getCurrentMonthKey,
  getIsoWeekLabel,
  getTodayIsoDate,
} from '../utils/format';

interface ReportsPageProps {
  products: Product[];
  transactions: Transaction[];
  onEditTransaction: (tx: Transaction) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  products,
  transactions,
  onEditTransaction,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'รับเข้า' | 'เบิกออก'>(
    'all'
  );
  const [txSearch, setTxSearch] = useState('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);

  const inventorySummary = useMemo(() => {
    const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0);
    const totalValue = products.reduce(
      (sum, p) => sum + p.quantity * p.unitPrice,
      0
    );
    return {
      totalSkus: products.length,
      totalUnits,
      totalValue,
    };
  }, [products]);

  const monthlyTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!selectedMonth) return true;
      return t.date.startsWith(selectedMonth);
    });
  }, [transactions, selectedMonth]);

  const monthlyTotals = useMemo(() => {
    let inQty = 0;
    let inValue = 0;
    let outQty = 0;
    let outValue = 0;

    for (const t of monthlyTransactions) {
      if (t.type === 'รับเข้า') {
        inQty += t.quantity;
        inValue += t.totalValue;
      } else {
        outQty += t.quantity;
        outValue += t.totalValue;
      }
    }

    return { inQty, inValue, outQty, outValue };
  }, [monthlyTransactions]);

  // Weekly chart data for Recharts
  const weeklyChartData = useMemo(() => {
    const weekMap = new Map<
      string,
      { key: string; weekLabel: string; รับเข้า: number; เบิกออก: number }
    >();

    for (const t of transactions) {
      if (!t.date) continue;
      const { key, label } = getIsoWeekLabel(t.date);
      const entry = weekMap.get(key) || {
        key,
        weekLabel: label,
        รับเข้า: 0,
        เบิกออก: 0,
      };
      if (t.type === 'รับเข้า') {
        entry.รับเข้า += t.quantity;
      } else {
        entry.เบิกออก += t.quantity;
      }
      weekMap.set(key, entry);
    }

    return Array.from(weekMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-8);
  }, [transactions]);

  const visibleTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return monthlyTransactions
      .filter((t) => {
        if (txTypeFilter !== 'all' && t.type !== txTypeFilter) return false;
        if (!q) return true;
        return (
          t.productCode.toLowerCase().includes(q) ||
          t.productName.toLowerCase().includes(q) ||
          t.party.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q)
        );
      })
      .slice()
      .reverse();
  }, [monthlyTransactions, txTypeFilter, txSearch]);

  const handleExportPdf = async () => {
    if (!pdfAreaRef.current) return;
    setExportError(null);
    setIsExportingPdf(true);
    try {
      await exportMonthlyPdf(pdfAreaRef.current, selectedMonth || 'all');
    } catch (err: unknown) {
      setExportError(
        err instanceof Error ? err.message : 'ไม่สามารถสร้างไฟล์ PDF ได้'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Exports */}
      <div className="no-print flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            รายงานสต็อคคงเหลือและบันทึกบัญชี
          </h1>
          <p className="mt-1 text-base text-slate-600">
            สรุปมูลค่าคลังสินค้า แนวโน้มรายสัปดาห์ แก้ไขรายการย้อนหลัง และออกรายงาน PDF ประจำเดือน / CSV
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-brand-900 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {isExportingPdf ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
            <span>{isExportingPdf ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลดรายงานประจำเดือน PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => exportTransactionsToCsv(monthlyTransactions, selectedMonth)}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-5 w-5 text-brand-800" />
            <span>ส่งออก CSV (เคลื่อนไหว)</span>
          </button>

          <button
            type="button"
            onClick={() => exportInventoryToCsv(products)}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-5 w-5 text-brand-800" />
            <span>ส่งออก CSV (คงเหลือ)</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Printer className="h-5 w-5" />
            <span>พิมพ์</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 p-4 text-base text-red-800">
          {exportError}
        </div>
      )}

      {/* Month Filter & KPIs */}
      <div className="no-print grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <label
            htmlFor="report-month-picker"
            className="block text-base text-slate-600"
          >
            เลือกเดือนสรุปรายงาน
          </label>
          <input
            id="report-month-picker"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-medium text-slate-900 focus:border-brand-700 focus:outline-none"
          />
          <p className="mt-1 text-sm text-brand-800">
            {selectedMonth ? formatThaiMonthLabel(selectedMonth) : 'ทุกเดือน'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-base text-slate-600">มูลค่าสินค้าคงเหลือปัจจุบัน</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-brand-900">
            ฿{formatCurrency(inventorySummary.totalValue)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {formatNumber(inventorySummary.totalSkus)} รายการ · {formatNumber(inventorySummary.totalUnits)} หน่วย
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-base text-slate-600">ยอดรับเข้าประจำเดือน</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-emerald-800">
            +{formatNumber(monthlyTotals.inQty)} หน่วย
          </p>
          <p className="mt-1 text-sm tabular-nums text-slate-600">
            มูลค่า ฿{formatCurrency(monthlyTotals.inValue)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-base text-slate-600">ยอดเบิกออกประจำเดือน</p>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-amber-800">
            -{formatNumber(monthlyTotals.outQty)} หน่วย
          </p>
          <p className="mt-1 text-sm tabular-nums text-slate-600">
            มูลค่า ฿{formatCurrency(monthlyTotals.outValue)}
          </p>
        </div>
      </div>

      {/* Weekly Stock Movement Chart (Recharts) */}
      <div className="no-print rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              แนวโน้มการเคลื่อนไหวสต็อคสินค้า (รายสัปดาห์)
            </h2>
            <p className="text-base text-slate-600">
              เปรียบเทียบปริมาณการรับเข้าและเบิกออกในแต่ละสัปดาห์
            </p>
          </div>
        </div>

        {weeklyChartData.length === 0 ? (
          <div className="py-12 text-center text-base text-slate-500">
            ยังไม่มีข้อมูลความเคลื่อนไหวเพียงพอสำหรับแสดงกราฟรายสัปดาห์
          </div>
        ) : (
          <div className="mt-5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyChartData}
                margin={{ top: 10, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fill: '#334155', fontSize: 14 }}
                />
                <YAxis tick={{ fill: '#334155', fontSize: 14 }} />
                <Tooltip
                  formatter={(value: unknown) => formatNumber(Number(value))}
                  labelFormatter={(label) => `สัปดาห์ ${label}`}
                  contentStyle={{
                    borderRadius: '10px',
                    borderColor: '#cbd5e1',
                    fontSize: '15px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '15px' }} />
                <Bar
                  dataKey="รับเข้า"
                  fill="#1d633a"
                  radius={[6, 6, 0, 0]}
                  name="รับเข้า (หน่วย)"
                />
                <Bar
                  dataKey="เบิกออก"
                  fill="#d97706"
                  radius={[6, 6, 0, 0]}
                  name="เบิกออก (หน่วย)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Editable Transactions History */}
      <div className="no-print rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              ประวัติความเคลื่อนไหว & แก้ไขรายการย้อนหลัง
            </h2>
            <p className="text-base text-slate-600">
              สามารถกดแก้ไขจำนวน ราคา หรือผู้ขาย/ผู้เบิกย้อนหลังได้ โดยระบบจะปรับยอดสต็อคคงเหลือให้อัตโนมัติ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="ค้นหารหัส ชื่อสินค้า ผู้ขาย..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-base text-slate-900 focus:border-brand-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(['all', 'รับเข้า', 'เบิกออก'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTxTypeFilter(tab)}
                  className={`rounded-md px-3 py-1.5 text-base font-medium transition-colors whitespace-nowrap ${
                    txTypeFilter === tab
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === 'all' ? 'ทั้งหมด' : tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleTransactions.length === 0 ? (
          <p className="py-10 text-center text-base text-slate-500">
            ไม่มีรายการความเคลื่อนไหวในเดือนที่เลือก
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-base">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">
                    วันที่ (พ.ศ.)
                  </th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">
                    ประเภท
                  </th>
                  <th className="px-3 py-3 font-semibold">สินค้า</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                    จำนวน
                  </th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                    ราคา/หน่วย
                  </th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                    มูลค่ารวม
                  </th>
                  <th className="px-3 py-3 font-semibold">ผู้ขาย / ผู้เบิก</th>
                  <th className="px-3 py-3 font-semibold">หมายเหตุ / ผู้แก้ไข</th>
                  <th className="px-3 py-3 text-right font-semibold">แก้ไข</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                      {formatThaiShortDate(tx.date)}
                    </td>
                    <td
                      className={`px-3 py-3 font-semibold whitespace-nowrap ${
                        tx.type === 'รับเข้า' ? 'text-emerald-800' : 'text-amber-800'
                      }`}
                    >
                      {tx.type}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">
                        {tx.productName}
                      </div>
                      <div className="font-mono text-sm text-slate-500">
                        {tx.productCode}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      {tx.type === 'รับเข้า' ? '+' : '-'}
                      {formatNumber(tx.quantity)} {tx.unit}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-800 whitespace-nowrap">
                      ฿{formatCurrency(tx.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      ฿{formatCurrency(tx.totalValue)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{tx.party}</td>
                    <td className="px-3 py-3 text-sm text-slate-600">
                      <div>{tx.notes || '-'}</div>
                      {tx.editedBy && (
                        <div className="mt-0.5 text-xs font-medium text-amber-800">
                          แก้ไขโดย: {tx.editedBy}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Edit3 className="h-4 w-4" />
                        <span>แก้ไข</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* A4 Printable / PDF Monthly Accounting Report Area */}
      <div
        ref={pdfAreaRef}
        id="monthly-accounting-pdf"
        className="mx-auto max-w-[900px] rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <div className="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <img
              src="/assets/aistudio/_________________________1__f33f9ccd.jpg"
              alt="โลโก้ บจก.พิพุทพูนผล"
              referrerPolicy="no-referrer"
              className="h-14 w-14 shrink-0 object-contain"
            />
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                สต็อตผลไม้ บจก.พิพุทพูนผล
              </h2>
              <p className="text-base font-semibold text-brand-900">
                รายงานสรุปสต็อคคงเหลือและบัญชีประจำเดือน{' '}
                {selectedMonth ? formatThaiMonthLabel(selectedMonth) : 'ทั้งหมด'}
              </p>
            </div>
          </div>
          <div className="text-sm text-slate-700 sm:text-right">
            <div>
              วันที่ออกรายงาน:{' '}
              <span className="font-semibold text-slate-900">
                {formatThaiShortDate(getTodayIsoDate())}
              </span>
            </div>
            <div>
              จำนวนรายการเคลื่อนไหว:{' '}
              <span className="font-semibold text-slate-900">
                {formatNumber(monthlyTransactions.length)} รายการ
              </span>
            </div>
          </div>
        </div>

        {/* Accounting Summary Box */}
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm">
          <div>
            <span className="block text-slate-600">รวมรับเข้าประจำเดือน</span>
            <span className="text-base font-bold tabular-nums text-emerald-800">
              +{formatNumber(monthlyTotals.inQty)} หน่วย (฿{formatCurrency(monthlyTotals.inValue)})
            </span>
          </div>
          <div>
            <span className="block text-slate-600">รวมเบิกออกประจำเดือน</span>
            <span className="text-base font-bold tabular-nums text-amber-800">
              -{formatNumber(monthlyTotals.outQty)} หน่วย (฿{formatCurrency(monthlyTotals.outValue)})
            </span>
          </div>
          <div>
            <span className="block text-slate-600">มูลค่าคงเหลือในคลังปัจจุบัน</span>
            <span className="text-base font-bold tabular-nums text-brand-900">
              ฿{formatCurrency(inventorySummary.totalValue)}
            </span>
          </div>
        </div>

        {/* Section 1: Current Inventory Valuation */}
        <h3 className="mt-5 font-display text-base font-bold text-slate-900">
          1. ตารางสรุปสินค้าคงเหลือและมูลค่าทางบัญชี
        </h3>
        <table className="mt-2 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-100 text-slate-800">
              <th className="px-2 py-2 font-semibold">รหัส</th>
              <th className="px-2 py-2 font-semibold">ชื่อสินค้า</th>
              <th className="px-2 py-2 font-semibold">หมวดหมู่</th>
              <th className="px-2 py-2 text-right font-semibold">คงเหลือ</th>
              <th className="px-2 py-2 text-right font-semibold">ราคา/หน่วย</th>
              <th className="px-2 py-2 text-right font-semibold">มูลค่ารวม (บาท)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-slate-500">
                  ไม่มีข้อมูลสินค้าคงเหลือ
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.code}>
                  <td className="px-2 py-2 font-mono">{p.code}</td>
                  <td className="px-2 py-2 font-medium text-slate-900">{p.name}</td>
                  <td className="px-2 py-2 text-slate-700">{p.category}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatNumber(p.quantity)} {p.unit}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatCurrency(p.unitPrice)}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">
                    {formatCurrency(p.quantity * p.unitPrice)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {products.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                <td colSpan={3} className="px-2 py-2 text-right">
                  รวมคงเหลือทั้งสิ้น
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatNumber(inventorySummary.totalUnits)} หน่วย
                </td>
                <td className="px-2 py-2 text-right">-</td>
                <td className="px-2 py-2 text-right tabular-nums text-brand-900">
                  ฿{formatCurrency(inventorySummary.totalValue)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Section 2: Monthly Transactions Detail */}
        <h3 className="mt-6 font-display text-base font-bold text-slate-900">
          2. รายละเอียดความเคลื่อนไหวทางบัญชี (Transactions)
        </h3>
        <table className="mt-2 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-100 text-slate-800">
              <th className="px-2 py-2 font-semibold">วันที่</th>
              <th className="px-2 py-2 font-semibold">ประเภท</th>
              <th className="px-2 py-2 font-semibold">สินค้า</th>
              <th className="px-2 py-2 text-right font-semibold">จำนวน</th>
              <th className="px-2 py-2 text-right font-semibold">ราคา/หน่วย</th>
              <th className="px-2 py-2 text-right font-semibold">มูลค่ารวม</th>
              <th className="px-2 py-2 font-semibold">ผู้ขาย / ผู้เบิก</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {monthlyTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-slate-500">
                  ไม่มีรายการความเคลื่อนไหวในเดือนนี้
                </td>
              </tr>
            ) : (
              monthlyTransactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {formatThaiShortDate(t.date)}
                  </td>
                  <td className="px-2 py-1.5 font-medium">{t.type}</td>
                  <td className="px-2 py-1.5">
                    {t.productCode} {t.productName}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatNumber(t.quantity)} {t.unit}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatCurrency(t.unitPrice)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {formatCurrency(t.totalValue)}
                  </td>
                  <td className="px-2 py-1.5">{t.party}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Signature Block */}
        <div className="mt-8 grid grid-cols-3 gap-6 border-t border-slate-200 pt-6 text-center text-sm text-slate-700">
          <div>
            <div className="mx-auto w-36 border-b border-slate-400 pb-5" />
            <p className="mt-1.5 font-medium text-slate-900">ผู้จัดทำบัญชี</p>
            <p className="text-xs text-slate-500">วันที่ ____/____/____</p>
          </div>
          <div>
            <div className="mx-auto w-36 border-b border-slate-400 pb-5" />
            <p className="mt-1.5 font-medium text-slate-900">ผู้ตรวจสอบ</p>
            <p className="text-xs text-slate-500">วันที่ ____/____/____</p>
          </div>
          <div>
            <div className="mx-auto w-36 border-b border-slate-400 pb-5" />
            <p className="mt-1.5 font-medium text-slate-900">ผู้อนุมัติ</p>
            <p className="text-xs text-slate-500">วันที่ ____/____/____</p>
          </div>
        </div>
      </div>
    </div>
  );
};
