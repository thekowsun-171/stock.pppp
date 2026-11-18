import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Product, ProductInput } from '../types/inventory';
import { AutocompleteInput } from './AutocompleteInput';
import { downloadBarcodePng } from '../utils/barcode';
import {
  generateNextProductCode,
  getTodayIsoDate,
} from '../utils/format';

interface ProductFormModalProps {
  isOpen: boolean;
  editingProduct: Product | null;
  existingProducts: Product[];
  savedCategories: string[];
  savedUnits: string[];
  savedVendors: string[];
  defaultVendor?: string;
  defaultDate?: string;
  onClose: () => void;
  onRequestSave: (input: ProductInput, existingProduct: Product | null) => void;
}

const BASE_UNITS = ['กิโลกรัม', 'ชิ้น', 'ลัง'];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  editingProduct,
  existingProducts,
  savedCategories,
  savedUnits,
  savedVendors,
  defaultVendor = '',
  defaultDate,
  onClose,
  onRequestSave,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('กิโลกรัม');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(getTodayIsoDate());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingProduct) {
      setCode(editingProduct.code);
      setName(editingProduct.name);
      setCategory(editingProduct.category);
      setUnit(editingProduct.unit || 'กิโลกรัม');
      setQuantity(String(editingProduct.quantity));
      setUnitPrice(
        editingProduct.unitPrice > 0 ? String(editingProduct.unitPrice) : ''
      );
      setVendor(editingProduct.vendor);
      setDate(editingProduct.updatedAt || getTodayIsoDate());
      setNotes(editingProduct.notes);
    } else {
      setCode(generateNextProductCode(existingProducts));
      setName('');
      setCategory('');
      setUnit('กิโลกรัม');
      setQuantity('');
      setUnitPrice(''); // ช่องราคาต่อหน่วยให้เป็นช่องว่างพร้อมพิมพ์ตัวเลขได้เลย ไม่ต้องขึ้น 0.0
      setVendor(defaultVendor);
      setDate(defaultDate || getTodayIsoDate());
      setNotes('');
    }
  }, [isOpen, editingProduct, existingProducts, defaultVendor, defaultDate]);

  if (!isOpen) return null;

  const unitOptions = Array.from(new Set([...BASE_UNITS, ...savedUnits]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('กรุณาระบุรหัสสินค้า');
      return;
    }
    if (!name.trim()) {
      setError('กรุณากรอกชื่อสินค้า');
      return;
    }
    if (!unit.trim()) {
      setError('กรุณาระบุหน่วยนับ');
      return;
    }

    const qtyNum = quantity.trim() === '' ? 0 : Number(quantity);
    const priceNum = unitPrice.trim() === '' ? 0 : Number(unitPrice);

    if (Number.isNaN(qtyNum) || qtyNum < 0) {
      setError(
        editingProduct
          ? 'จำนวนคงเหลือต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'
          : 'จำนวนที่รับเข้าต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'
      );
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError('ราคาต่อหน่วยต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
      return;
    }

    onRequestSave(
      {
        code: code.trim(),
        name: name.trim(),
        category: category.trim() || 'ผลไม้ทั่วไป',
        unit: unit.trim(),
        quantity: qtyNum,
        unitPrice: priceNum,
        vendor: vendor.trim(),
        date: date || getTodayIsoDate(),
        notes: notes.trim(),
      },
      editingProduct
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <h2 className="font-display text-xl font-semibold text-slate-900">
            {editingProduct ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base text-red-800">
              {error}
            </div>
          )}

          {/* รหัสสินค้า 5 หลัก + ปุ่มดาวน์โหลดรูปภาพบาร์โค้ด .png โดยตรง (ไม่มีพรีวิว) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-base font-medium text-slate-700">
                รหัสสินค้า (5 หลักอัตโนมัติ) *
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-lg font-semibold text-slate-900 focus:border-brand-700 focus:bg-white focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => downloadBarcodePng(code, name)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-brand-800 bg-brand-50 px-3 py-2 text-brand-900 transition-colors hover:bg-emerald-100 shrink-0"
                  title="ดาวน์โหลดรูปภาพบาร์โค้ด Code-128 (.png)"
                  aria-label="ดาวน์โหลดรูปภาพบาร์โค้ด (.png)"
                >
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-base font-medium text-slate-700">
                วันที่ (ว/ด/ป)
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-brand-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-base font-medium text-slate-700">
              ชื่อสินค้า *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ทุเรียนหมอนทอง เกรด A, มะม่วงน้ำดอกไม้"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-base font-medium text-slate-700">
                หมวดหมู่
              </label>
              <div className="mt-1.5">
                <AutocompleteInput
                  value={category}
                  onChange={setCategory}
                  options={savedCategories}
                  placeholder="เลือกหรือพิมพ์หมวดหมู่ใหม่"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-medium text-slate-700">
                หน่วยนับ *
              </label>
              <div className="mt-1.5">
                <AutocompleteInput
                  value={unit}
                  onChange={setUnit}
                  options={unitOptions}
                  placeholder="กิโลกรัม, ชิ้น, ลัง หรือพิมพ์เพิ่ม"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-base font-medium text-slate-700">
                {editingProduct ? 'จำนวนคงเหลือ' : 'จำนวนที่รับเข้า'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="ระบุจำนวน"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-right text-base tabular-nums text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
            </div>

            <div>
              <label className="block text-base font-medium text-slate-700">
                ราคาต่อหน่วย (บาท)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="พิมพ์ราคาต่อหน่วย"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-right text-base tabular-nums text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-base font-medium text-slate-700">
                ชื่อผู้ขาย (Vendor)
              </label>
              <div className="mt-1.5">
                <AutocompleteInput
                  value={vendor}
                  onChange={setVendor}
                  options={savedVendors}
                  placeholder="เลือกหรือพิมพ์ชื่อสวน / ผู้ขาย"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-medium text-slate-700">
                หมายเหตุ
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-800 px-6 py-2.5 text-base font-semibold text-white transition-colors hover:bg-brand-900 whitespace-nowrap"
            >
              {editingProduct ? 'บันทึกการแก้ไข' : 'บันทึกสินค้าใหม่'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
