import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  CheckCircle2,
  Minus,
  Plus,
  QrCode,
  Search,
  Trash2,
} from 'lucide-react';
import {
  Product,
  StockDraftItem,
  Transaction,
} from '../types/inventory';
import { AutocompleteInput } from '../components/AutocompleteInput';
import {
  formatCurrency,
  formatNumber,
  formatThaiShortDate,
  getTodayIsoDate,
} from '../utils/format';

interface StockMovementPageProps {
  mode: 'in' | 'out';
  products: Product[];
  transactions: Transaction[];
  savedVendors: string[];
  savedWithdrawers: string[];
  onOpenScanner: (onScanned: (code: string) => void) => void;
  onQuickAddProduct?: (defaults: { vendor: string; date: string }) => void;
  onRequestSubmit: (
    items: StockDraftItem[],
    meta: { date: string; party: string; notes: string },
    onSuccess: () => void
  ) => void;
}

export const StockMovementPage: React.FC<StockMovementPageProps> = ({
  mode,
  products,
  transactions,
  savedVendors,
  savedWithdrawers,
  onOpenScanner,
  onQuickAddProduct,
  onRequestSubmit,
}) => {
  const isStockIn = mode === 'in';
  const [productQuery, setProductQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [draftItems, setDraftItems] = useState<
    Array<StockDraftItem & { qtyText: string }>
  >([]);
  const [date, setDate] = useState(getTodayIsoDate());
  const [party, setParty] = useState('');
  const [notes, setNotes] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const matchingProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 15);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [products, productQuery]);

  const addProductToDraft = (product: Product) => {
    setFeedback(null);
    if (!isStockIn && product.quantity <= 0) {
      setFeedback({
        type: 'error',
        text: `สินค้า "${product.name}" (${product.code}) คงเหลือ 0 ${product.unit} ไม่สามารถเบิกออกได้`,
      });
      return;
    }

    setDraftItems((prev) => {
      const existing = prev.find((i) => i.product.code === product.code);
      if (existing) {
        const nextQty = existing.quantity + 1;
        if (!isStockIn && nextQty > product.quantity) {
          setFeedback({
            type: 'error',
            text: `สินค้า "${product.name}" คงเหลือเพียง ${formatNumber(product.quantity)} ${product.unit}`,
          });
          return prev;
        }
        return prev.map((i) =>
          i.product.code === product.code
            ? { ...i, quantity: nextQty, qtyText: String(nextQty) }
            : i
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 0,
          qtyText: '',
          unitPrice: product.unitPrice,
        },
      ];
    });
  };

  const handleBarcodeOrSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = productQuery.trim().toLowerCase();
    if (!q) return;

    const exact = products.find(
      (p) => p.code.toLowerCase() === q || p.name.toLowerCase() === q
    );
    const match = exact || (matchingProducts.length === 1 ? matchingProducts[0] : null);

    if (!match) {
      setFeedback({
        type: 'error',
        text: `ไม่พบสินค้าที่ตรงกับ "${productQuery.trim()}" กรุณาเลือกจากรายการหรือกด + เพิ่มสินค้าใหม่`,
      });
      return;
    }

    addProductToDraft(match);
    setProductQuery('');
    setDropdownOpen(false);
    searchInputRef.current?.focus();
  };

  const handleCameraScan = (scannedCode: string) => {
    const q = scannedCode.trim().toLowerCase();
    const match = products.find(
      (p) => p.code.toLowerCase() === q || p.name.toLowerCase() === q
    );
    if (!match) {
      setFeedback({
        type: 'error',
        text: `ไม่พบสินค้ารหัส "${scannedCode.trim()}" ในระบบ`,
      });
      return;
    }
    addProductToDraft(match);
  };

  const updateItemQtyText = (code: string, rawVal: string) => {
    setFeedback(null);
    if (rawVal.trim() === '') {
      setDraftItems((prev) =>
        prev.map((item) =>
          item.product.code === code
            ? { ...item, quantity: 0, qtyText: '' }
            : item
        )
      );
      return;
    }

    const parsed = Number(rawVal);
    if (Number.isNaN(parsed) || parsed < 0) return;

    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.product.code !== code) return item;
        if (!isStockIn && parsed > item.product.quantity) {
          setFeedback({
            type: 'error',
            text: `จำนวนเบิกของ "${item.product.name}" เกินยอดคงเหลือ (${formatNumber(item.product.quantity)} ${item.product.unit})`,
          });
          return {
            ...item,
            quantity: item.product.quantity,
            qtyText: String(item.product.quantity),
          };
        }
        return { ...item, quantity: parsed, qtyText: rawVal };
      })
    );
  };

  const stepItemQty = (code: string, delta: number) => {
    setFeedback(null);
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.product.code !== code) return item;
        const nextQty = Math.max(0, Number((item.quantity + delta).toFixed(4)));
        if (!isStockIn && nextQty > item.product.quantity) {
          setFeedback({
            type: 'error',
            text: `จำนวนเบิกของ "${item.product.name}" เกินยอดคงเหลือ (${formatNumber(item.product.quantity)} ${item.product.unit})`,
          });
          return {
            ...item,
            quantity: item.product.quantity,
            qtyText: String(item.product.quantity),
          };
        }
        return {
          ...item,
          quantity: nextQty,
          qtyText: nextQty === 0 ? '' : String(nextQty),
        };
      })
    );
  };

  const updateItemPrice = (code: string, rawVal: string) => {
    const num = rawVal.trim() === '' ? 0 : Number(rawVal);
    if (Number.isNaN(num) || num < 0) return;
    setDraftItems((prev) =>
      prev.map((item) =>
        item.product.code === code ? { ...item, unitPrice: num } : item
      )
    );
  };

  const removeItem = (code: string) => {
    setDraftItems((prev) => prev.filter((item) => item.product.code !== code));
  };

  const totals = useMemo(() => {
    const totalQty = draftItems.reduce((sum, i) => sum + i.quantity, 0);
    const totalVal = draftItems.reduce(
      (sum, i) => sum + i.quantity * i.unitPrice,
      0
    );
    return { totalQty, totalVal };
  }, [draftItems]);

  const handleSubmitBatch = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (draftItems.length === 0) {
      setFeedback({
        type: 'error',
        text: 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการก่อนบันทึก',
      });
      return;
    }
    if (draftItems.some((item) => item.quantity <= 0)) {
      setFeedback({
        type: 'error',
        text: isStockIn
          ? 'กรุณาระบุจำนวนรับเข้าให้มากกว่า 0 ทุกรายการ'
          : 'กรุณาระบุจำนวนเบิกออกให้มากกว่า 0 ทุกรายการ',
      });
      return;
    }
    if (!party.trim()) {
      setFeedback({
        type: 'error',
        text: isStockIn
          ? 'กรุณาระบุชื่อผู้ขาย (Vendor)'
          : 'กรุณาระบุชื่อลูกค้า',
      });
      return;
    }

    onRequestSubmit(
      draftItems.map(({ product, quantity, unitPrice }) => ({
        product,
        quantity,
        unitPrice,
      })),
      {
        date: date || getTodayIsoDate(),
        party: party.trim(),
        notes: notes.trim(),
      },
      () => {
        setDraftItems([]);
        setParty('');
        setNotes('');
        setFeedback({
          type: 'success',
          text: isStockIn
            ? 'บันทึกรับเข้าสินค้าและอัปเดตยอดคงเหลือเรียบร้อยแล้ว'
            : 'บันทึกเบิกสินค้าและตัดยอดสต็อคคงเหลือเรียบร้อยแล้ว',
        });
      }
    );
  };

  const typeLabel = isStockIn ? 'รับเข้า' : 'เบิกออก';
  const filteredLogs = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return transactions
      .filter((t) => t.type === typeLabel)
      .filter((t) => {
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
  }, [transactions, typeLabel, historySearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            {isStockIn ? (
              <ArrowDownToLine className="h-6 w-6 text-brand-800" />
            ) : (
              <ArrowUpFromLine className="h-6 w-6 text-amber-700" />
            )}
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {isStockIn ? 'รับเข้าสินค้า' : 'สินค้าออกจากคลัง'}
            </h1>
          </div>
          <p className="mt-1 text-base text-slate-600">
            {isStockIn
              ? 'พิมพ์ชื่อสินค้า สแกนบาร์โค้ด 1D หรือเพิ่มสินค้าใหม่ได้โดยตรงจากหน้านี้'
              : 'สแกนบาร์โค้ดหรือเลือกสินค้าจากรายการ ระบบจะตรวจสอบยอดคงเหลืออัตโนมัติ'}
          </p>
        </div>

        {isStockIn && onQuickAddProduct && (
          <button
            type="button"
            onClick={() => onQuickAddProduct({ vendor: party, date })}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-base font-semibold text-white transition-colors hover:bg-brand-900 whitespace-nowrap shrink-0"
          >
            <Plus className="h-5 w-5" />
            <span>เพิ่มสินค้าใหม่</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-4 text-base ${
            feedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Search Product Autocomplete + Barcode Scan */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          ค้นหาสินค้าด้วยชื่อ หรือสแกนบาร์โค้ด (5 หลัก)
        </h2>

        <form onSubmit={handleBarcodeOrSearchSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={productQuery}
              onFocus={() => setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 180)}
              onChange={(e) => {
                setProductQuery(e.target.value);
                setDropdownOpen(true);
              }}
              placeholder="พิมพ์ชื่อสินค้า หรือยิงบาร์โค้ด 5 หลัก เช่น 69001 แล้วกด Enter"
              className="w-full rounded-lg border border-slate-300 py-2.5 pl-11 pr-4 text-base text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />

            {dropdownOpen && matchingProducts.length > 0 && (
              <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                {matchingProducts.map((p) => (
                  <li key={p.code}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addProductToDraft(p);
                        setProductQuery('');
                        setDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-base hover:bg-brand-50"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-semibold text-brand-900">
                          {p.code}
                        </span>{' '}
                        <span className="font-medium text-slate-900">{p.name}</span>
                        <span className="ml-2 text-sm text-slate-500">
                          ({p.category})
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">
                        คงเหลือ {formatNumber(p.quantity)} {p.unit}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-900 px-5 py-2 text-base font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              เพิ่มรายการ
            </button>
            <button
              type="button"
              onClick={() => onOpenScanner(handleCameraScan)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-brand-800 bg-brand-50 px-4 py-2 text-base font-semibold text-brand-900 hover:bg-emerald-100 whitespace-nowrap shrink-0"
            >
              <QrCode className="h-5 w-5" />
              <span>สแกนกล้อง</span>
            </button>
          </div>
        </form>
      </div>

      {/* Draft List + Date/Vendor Form */}
      <form
        onSubmit={handleSubmitBatch}
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {isStockIn ? 'รายการรับเข้า' : 'รายการสินค้าออกจากคลัง'} (
            {draftItems.length} รายการ)
          </h2>
          {draftItems.length > 0 && (
            <button
              type="button"
              onClick={() => setDraftItems([])}
              className="text-base font-medium text-red-600 hover:underline"
            >
              ล้างรายการ
            </button>
          )}
        </div>

        {draftItems.length === 0 ? (
          <div className="py-10 text-center text-base text-slate-500">
            ยังไม่มีรายการสินค้า กรุณาพิมพ์ค้นหาชื่อสินค้า หรือสแกนบาร์โค้ดจากด้านบน
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-base">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="px-3 py-3 font-semibold">สินค้า</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                    คงเหลือเดิม
                  </th>
                  <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                    {isStockIn ? 'จำนวนรับเข้า' : 'จำนวนเบิกออก'}
                  </th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                    ราคาต่อหน่วย
                  </th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                    มูลค่ารวม
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {draftItems.map((item) => (
                  <tr key={item.product.code}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">
                        {item.product.name}
                      </div>
                      <div className="font-mono text-sm text-slate-500">
                        {item.product.code} · {item.product.category}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                      {formatNumber(item.product.quantity)} {item.product.unit}
                    </td>
                    <td className="px-3 py-3">
                      <div className="mx-auto flex w-fit items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => stepItemQty(item.product.code, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                          aria-label="ลดจำนวน"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={isStockIn ? undefined : item.product.quantity}
                          step="any"
                          value={item.qtyText}
                          placeholder="ระบุจำนวน"
                          onChange={(e) =>
                            updateItemQtyText(item.product.code, e.target.value)
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-center text-base font-semibold tabular-nums text-slate-900 focus:border-brand-700 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => stepItemQty(item.product.code, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
                          aria-label="เพิ่มจำนวน"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isStockIn ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice === 0 ? '' : item.unitPrice}
                          placeholder="ระบุราคา"
                          onChange={(e) =>
                            updateItemPrice(item.product.code, e.target.value)
                          }
                          className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-base tabular-nums text-slate-900 focus:border-brand-700 focus:outline-none"
                        />
                      ) : (
                        <span className="tabular-nums text-slate-700">
                          ฿{formatCurrency(item.unitPrice)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      ฿{formatCurrency(item.quantity * item.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(item.product.code)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                        aria-label={`ลบ ${item.product.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Date (ว/ด/ป + พ.ศ.), Vendor/Withdrawer, Notes */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
          <div>
            <label className="flex items-center gap-1.5 text-base font-medium text-slate-700">
              <Calendar className="h-4 w-4 text-brand-800" />
              <span>วันที่ (ว/ด/ป) *</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-brand-700 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-base font-medium text-slate-700">
              {isStockIn ? 'ชื่อผู้ขาย (Vendor) *' : 'ชื่อลูกค้า *'}
            </label>
            <div className="mt-1.5">
              <AutocompleteInput
                value={party}
                onChange={setParty}
                options={isStockIn ? savedVendors : savedWithdrawers}
                placeholder={
                  isStockIn
                    ? 'พิมพ์หรือเลือกชื่อผู้ขาย/สวน'
                    : 'พิมพ์หรือเลือกชื่อลูกค้า'
                }
                required
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
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-brand-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col justify-between gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-6 text-base">
            <div>
              <span className="text-slate-600">ปริมาณรวม: </span>
              <span className="font-bold tabular-nums text-slate-900">
                {formatNumber(totals.totalQty)} หน่วย
              </span>
            </div>
            <div>
              <span className="text-slate-600">มูลค่ารวม: </span>
              <span className="font-bold tabular-nums text-brand-900">
                ฿{formatCurrency(totals.totalVal)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={draftItems.length === 0}
            className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-base font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
              isStockIn
                ? 'bg-brand-800 hover:bg-brand-900'
                : 'bg-amber-700 hover:bg-amber-800'
            }`}
          >
            {isStockIn ? (
              <ArrowDownToLine className="h-5 w-5" />
            ) : (
              <ArrowUpFromLine className="h-5 w-5" />
            )}
            <span>
              {isStockIn ? 'ยืนยันบันทึกรับเข้าสินค้า' : 'ยืนยันบันทึกเบิกสินค้า'}
            </span>
          </button>
        </div>
      </form>

      {/* Recent Transactions (No Transaction ID or unnecessary Ref Code columns) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {isStockIn ? 'ประวัติรับเข้าสินค้าล่าสุด' : 'ประวัติเบิกสินค้าล่าสุด'}
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder={
                isStockIn
                  ? 'ค้นหาชื่อสินค้า หรือผู้ขาย...'
                  : 'ค้นหาชื่อสินค้า หรือชื่อลูกค้า...'
              }
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-base text-slate-900 focus:border-brand-700 focus:outline-none"
            />
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <p className="py-8 text-center text-base text-slate-500">
            ยังไม่มีประวัติรายการ
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
                    รหัสสินค้า
                  </th>
                  <th className="px-3 py-3 font-semibold">ชื่อสินค้า</th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                    จำนวน
                  </th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                    ราคา/หน่วย
                  </th>
                  <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                    มูลค่ารวม
                  </th>
                  <th className="px-3 py-3 font-semibold">
                    {isStockIn ? 'ผู้ขาย (Vendor)' : 'ชื่อลูกค้า'}
                  </th>
                  <th className="px-3 py-3 font-semibold">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.slice(0, 30).map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-3 text-base text-slate-700 whitespace-nowrap">
                      {formatThaiShortDate(log.date)}
                    </td>
                    <td className="px-3 py-3 font-mono text-base font-medium text-slate-800 whitespace-nowrap">
                      {log.productCode}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">
                      {log.productName}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      {formatNumber(log.quantity)} {log.unit}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-800 whitespace-nowrap">
                      ฿{formatCurrency(log.unitPrice)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      ฿{formatCurrency(log.totalValue)}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{log.party}</td>
                    <td className="px-3 py-3 text-slate-600">{log.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
