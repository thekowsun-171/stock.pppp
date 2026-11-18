import React, { useMemo, useState } from 'react';
import {
  Barcode,
  Download,
  Edit3,
  PackageOpen,
  Plus,
  QrCode,
  Search,
  Trash2,
} from 'lucide-react';
import { Product } from '../types/inventory';
import { downloadBarcodePng } from '../utils/barcode';
import {
  formatCurrency,
  formatNumber,
  formatThaiShortDate,
} from '../utils/format';

interface InventoryPageProps {
  products: Product[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onViewBarcode: (product: Product) => void;
  onOpenScanner: (onScanned: (code: string) => void) => void;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onViewBarcode,
  onOpenScanner,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'empty'>(
    'all'
  );

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ['ทั้งหมด', ...Array.from(set)];
  }, [products]);

  const stats = useMemo(() => {
    let totalValue = 0;
    let totalUnits = 0;
    let outCount = 0;

    for (const p of products) {
      totalValue += p.quantity * p.unitPrice;
      totalUnits += p.quantity;
      if (p.quantity <= 0) outCount += 1;
    }

    return {
      totalItems: products.length,
      totalUnits,
      totalValue,
      outCount,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'ทั้งหมด' && p.category !== selectedCategory) {
        return false;
      }
      if (stockFilter === 'inStock' && p.quantity <= 0) return false;
      if (stockFilter === 'empty' && p.quantity > 0) return false;
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q)
      );
    });
  }, [products, searchTerm, selectedCategory, stockFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            จัดการข้อมูลสต็อคสินค้า
          </h1>
          <p className="mt-1 text-base text-slate-600">
            ตรวจสอบยอดคงเหลือ มูลค่าสินค้า ค้นหาด้วยบาร์โค้ด 1D และจัดการรายการสินค้า
          </p>
        </div>
        <button
          type="button"
          onClick={onAddProduct}
          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-brand-900 whitespace-nowrap shrink-0"
        >
          <Plus className="h-5 w-5" />
          <span>เพิ่มสินค้าใหม่</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-base text-slate-600">รายการสินค้าทั้งหมด</p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatNumber(stats.totalItems)}{' '}
            <span className="text-base font-normal text-slate-500">รายการ</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-base text-slate-600">ปริมาณคงเหลือรวม</p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-slate-900">
            {formatNumber(stats.totalUnits)}{' '}
            <span className="text-base font-normal text-slate-500">หน่วย</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-base text-slate-600">มูลค่าสินค้าคงเหลือรวม</p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-brand-900">
            ฿{formatCurrency(stats.totalValue)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-base text-slate-600">สินค้าหมดสต็อค</p>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums text-red-700">
            {formatNumber(stats.outCount)}{' '}
            <span className="text-base font-normal text-slate-500">รายการ</span>
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหารหัส 5 หลัก ชื่อสินค้า หมวดหมู่ หรือผู้ขาย..."
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-11 pr-4 text-base text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
            </div>
            <button
              type="button"
              onClick={() => onOpenScanner((code) => setSearchTerm(code))}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <QrCode className="h-5 w-5 text-brand-800" />
              <span>สแกนค้นหา</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="กรองตามหมวดหมู่"
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-base text-slate-800 focus:border-brand-700 focus:outline-none"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  หมวดหมู่: {cat}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {(
                [
                  { id: 'all', label: 'ทั้งหมด' },
                  { id: 'inStock', label: 'มีสินค้า' },
                  { id: 'empty', label: 'หมดสต็อค' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStockFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-base font-medium transition-colors whitespace-nowrap shrink-0 ${
                    stockFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {products.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
          <PackageOpen className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-4 font-display text-xl font-semibold text-slate-900">
            ยังไม่มีรายการสินค้าในระบบ
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-base text-slate-600">
            กดปุ่ม &ldquo;เพิ่มสินค้าใหม่&rdquo; เพื่อสร้างรหัสสินค้า 5 หลัก (69001) และเริ่มรับเข้าสต็อคผลไม้ได้ทันที
          </p>
          <button
            type="button"
            onClick={onAddProduct}
            className="mt-6 inline-flex min-h-[46px] items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-base font-semibold text-white hover:bg-brand-900"
          >
            <Plus className="h-5 w-5" />
            <span>เพิ่มสินค้าใหม่</span>
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-lg font-medium text-slate-800">
            ไม่พบสินค้าที่ตรงกับการค้นหา
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('ทั้งหมด');
              setStockFilter('all');
            }}
            className="mt-3 text-base font-medium text-brand-800 hover:underline"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-base">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <th className="px-4 py-3.5 font-semibold whitespace-nowrap">
                      รหัสสินค้า
                    </th>
                    <th className="px-4 py-3.5 font-semibold">ชื่อสินค้า</th>
                    <th className="px-4 py-3.5 font-semibold whitespace-nowrap">
                      หมวดหมู่
                    </th>
                    <th className="px-4 py-3.5 text-right font-semibold whitespace-nowrap">
                      คงเหลือ
                    </th>
                    <th className="px-4 py-3.5 text-right font-semibold whitespace-nowrap">
                      ราคาต่อหน่วย
                    </th>
                    <th className="px-4 py-3.5 text-right font-semibold whitespace-nowrap">
                      มูลค่ารวม
                    </th>
                    <th className="px-4 py-3.5 font-semibold whitespace-nowrap">
                      บาร์โค้ด 1D
                    </th>
                    <th className="px-4 py-3.5 text-right font-semibold whitespace-nowrap">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredProducts.map((p) => {
                    const rowValue = p.quantity * p.unitPrice;
                    return (
                      <tr
                        key={p.code}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3.5 align-top font-mono text-base font-semibold text-slate-900 whitespace-nowrap">
                          {p.code}
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <div className="font-medium text-slate-900">
                            {p.name}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            {p.vendor && <span>ผู้ขาย: {p.vendor}</span>}
                            {p.vendor && p.updatedAt && (
                              <span aria-hidden="true">·</span>
                            )}
                            {p.updatedAt && (
                              <span>อัปเดต {formatThaiShortDate(p.updatedAt)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 align-top text-slate-700 whitespace-nowrap">
                          {p.category}
                        </td>
                        <td className="px-4 py-3.5 text-right align-top tabular-nums whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              p.quantity <= 0 ? 'text-red-700' : 'text-slate-900'
                            }`}
                          >
                            {formatNumber(p.quantity)} {p.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right align-top tabular-nums text-slate-800 whitespace-nowrap">
                          ฿{formatCurrency(p.unitPrice)}
                        </td>
                        <td className="px-4 py-3.5 text-right align-top font-semibold tabular-nums text-brand-900 whitespace-nowrap">
                          ฿{formatCurrency(rowValue)}
                        </td>
                        <td className="px-4 py-3.5 align-top whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewBarcode(p)}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                              title="ดูและพิมพ์บาร์โค้ด 1D"
                            >
                              <Barcode className="h-4 w-4 text-brand-800" />
                              <span>ดู / พิมพ์</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadBarcodePng(p.code, p.name)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-brand-800 hover:bg-brand-50"
                              title="ดาวน์โหลดบาร์โค้ด .PNG"
                              aria-label={`ดาวน์โหลดบาร์โค้ด ${p.code}`}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right align-top whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onEditProduct(p)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              title="แก้ไขสินค้า"
                              aria-label={`แก้ไข ${p.name}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteProduct(p)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-red-600 hover:border-red-200 hover:bg-red-50"
                              title="ลบสินค้า"
                              aria-label={`ลบ ${p.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile / Tablet Card List */}
          <div className="space-y-3 lg:hidden">
            {filteredProducts.map((p) => {
              const rowValue = p.quantity * p.unitPrice;
              return (
                <div
                  key={p.code}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span className="font-mono font-semibold text-slate-900">
                          {p.code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{p.category}</span>
                      </div>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">
                        {p.name}
                      </h3>
                      {p.vendor && (
                        <p className="mt-0.5 text-sm text-slate-500">
                          ผู้ขาย: {p.vendor}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-base">
                    <div>
                      <span className="block text-sm text-slate-500">คงเหลือ</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          p.quantity <= 0 ? 'text-red-700' : 'text-slate-900'
                        }`}
                      >
                        {formatNumber(p.quantity)} {p.unit}
                      </span>
                    </div>
                    <div>
                      <span className="block text-sm text-slate-500">ราคา/หน่วย</span>
                      <span className="font-medium tabular-nums text-slate-800">
                        ฿{formatCurrency(p.unitPrice)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-sm text-slate-500">มูลค่ารวม</span>
                      <span className="font-semibold tabular-nums text-brand-900">
                        ฿{formatCurrency(rowValue)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => onViewBarcode(p)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-base font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Barcode className="h-4 w-4 text-brand-800" />
                      <span>บาร์โค้ด</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditProduct(p)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-base font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>แก้ไข</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProduct(p)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-base font-medium text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>ลบ</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
