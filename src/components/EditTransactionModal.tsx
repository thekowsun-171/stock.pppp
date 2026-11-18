import React, { useEffect, useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { Product, Transaction } from '../types/inventory';
import { formatCurrency, formatNumber, formatThaiLongDate } from '../utils/format';

interface EditTransactionModalProps {
  transaction: Transaction | null;
  product: Product | undefined;
  onClose: () => void;
  onRequestSaveEdit: (
    original: Transaction,
    updated: {
      date: string;
      quantity: number;
      unitPrice: number;
      party: string;
      notes: string;
      editedBy: string;
    }
  ) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  product,
  onClose,
  onRequestSaveEdit,
}) => {
  const [date, setDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [party, setParty] = useState('');
  const [notes, setNotes] = useState('');
  const [editedBy, setEditedBy] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transaction) return;
    setError(null);
    setDate(transaction.date);
    setQuantity(String(transaction.quantity));
    setUnitPrice(String(transaction.unitPrice));
    setParty(transaction.party);
    setNotes(transaction.notes);
    setEditedBy(''); // บังคับให้กรอกชื่อพนักงานผู้แก้ไขทุกครั้ง
  }, [transaction]);

  if (!transaction) return null;

  const newQtyNum = Number(quantity);
  const newPriceNum = Number(unitPrice);
  const qtyDiff = Number.isNaN(newQtyNum)
    ? 0
    : transaction.type === 'รับเข้า'
      ? newQtyNum - transaction.quantity
      : transaction.quantity - newQtyNum;
  const projectedStock = (product?.quantity ?? 0) + qtyDiff;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!editedBy.trim()) {
      setError('กรุณากรอกชื่อพนักงานผู้แก้ไขทุกครั้งก่อนบันทึก');
      return;
    }
    if (Number.isNaN(newQtyNum) || newQtyNum <= 0) {
      setError('จำนวนต้องมากกว่า 0');
      return;
    }
    if (Number.isNaN(newPriceNum) || newPriceNum < 0) {
      setError('ราคาต่อหน่วยต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
      return;
    }
    if (product && projectedStock < 0) {
      setError(
        `ไม่สามารถแก้ไขจำนวนนี้ได้ เพราะจะทำให้สต็อคคงเหลือติดลบ (${projectedStock} ${product.unit})`
      );
      return;
    }

    onRequestSaveEdit(transaction, {
      date,
      quantity: newQtyNum,
      unitPrice: newPriceNum,
      party: party.trim(),
      notes: notes.trim(),
      editedBy: editedBy.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900">
              แก้ไขรายการย้อนหลัง ({transaction.type})
            </h2>
            <p className="text-base text-slate-600">
              {transaction.productCode} · {transaction.productName}
            </p>
          </div>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-base font-medium text-slate-700">
                วันที่ (ว/ด/ป)
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-brand-700 focus:outline-none"
                required
              />
              <p className="mt-1 text-sm text-slate-500">
                พ.ศ.: {formatThaiLongDate(date)}
              </p>
            </div>

            <div>
              <label className="block text-base font-medium text-slate-700">
                {transaction.type === 'รับเข้า' ? 'ชื่อผู้ขาย (Vendor)' : 'ชื่อลูกค้า'}
              </label>
              <input
                type="text"
                value={party}
                onChange={(e) => setParty(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-brand-700 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-base font-medium text-slate-700">
                จำนวน ({transaction.unit})
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-right text-base tabular-nums text-slate-900 focus:border-brand-700 focus:outline-none"
                required
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
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-right text-base tabular-nums text-slate-900 focus:border-brand-700 focus:outline-none"
                required
              />
            </div>
          </div>

          {product && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-base text-slate-700">
              <div>
                มูลค่ารายการใหม่:{' '}
                <span className="font-semibold tabular-nums text-slate-900">
                  ฿
                  {formatCurrency(
                    (Number.isNaN(newQtyNum) ? 0 : newQtyNum) *
                      (Number.isNaN(newPriceNum) ? 0 : newPriceNum)
                  )}
                </span>
              </div>
              <div className="mt-1">
                ยอดสต็อคคงเหลือหลังปรับอัตโนมัติ:{' '}
                <span
                  className={`font-semibold tabular-nums ${
                    projectedStock < 0 ? 'text-red-700' : 'text-brand-900'
                  }`}
                >
                  {formatNumber(projectedStock)} {product.unit}
                </span>{' '}
                (เดิม {formatNumber(product.quantity)} {product.unit})
              </div>
            </div>
          )}

          <div>
            <label className="block text-base font-medium text-slate-700">
              หมายเหตุ
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เหตุผลการแก้ไขหรือหมายเหตุเพิ่มเติม"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-brand-700 focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
            <label className="flex items-center gap-2 text-base font-semibold text-amber-950">
              <UserCheck className="h-5 w-5 text-amber-700" />
              <span>ชื่อพนักงานผู้แก้ไข (จำเป็นต้องระบุ) *</span>
            </label>
            <input
              type="text"
              value={editedBy}
              onChange={(e) => setEditedBy(e.target.value)}
              placeholder="กรอกชื่อ-สกุลพนักงานที่ทำการแก้ไข"
              className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3.5 py-2.5 text-base text-slate-900 focus:border-brand-700 focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-800 px-6 py-2.5 text-base font-semibold text-white hover:bg-brand-900"
            >
              บันทึกการแก้ไขและปรับสต็อค
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
